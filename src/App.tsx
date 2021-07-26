import React from "react";
import {useEffect, useState, useRef} from "react";
import "./App.css";

type Result<T> = {isError: false; value: T} | {isError: true; message: string};
function ok<T>(x: T): Result<T> {
  return {isError: false, value: x};
}
function err<T>(message: string): Result<T> {
  return {isError: true, message};
}

type ColorControlCommand =
  | {cmd: "reset_all"}
  | {cmd: "reset_fg_color"}
  | {cmd: "reset_bg_color"}
  | {cmd: "set_bold"}
  | {cmd: "set_fg_color"; color: number}
  | {cmd: "set_bg_color"; color: number};

function byteStringToControlCommand(
  bytestring: string
): Result<ColorControlCommand> {
  if (bytestring == "0") {
    return ok({cmd: "reset_all"});
  }
  if (bytestring == "1") {
    return ok({cmd: "set_bold"});
  }
  if (bytestring == "39") {
    return ok({cmd: "reset_fg_color"});
  }
  if (bytestring == "49") {
    return ok({cmd: "reset_bg_color"});
  }
  let bytestringInt = parseInt(bytestring, 10);
  if (
    (bytestringInt >= 30 && bytestringInt <= 37) ||
    (bytestringInt >= 90 && bytestringInt <= 97)
  ) {
    return ok({cmd: "set_fg_color", color: bytestringInt});
  }
  if (
    (bytestringInt >= 40 && bytestringInt <= 47) ||
    (bytestringInt >= 100 && bytestringInt <= 107)
  ) {
    return ok({cmd: "set_bg_color", color: bytestringInt});
  }

  return err(`Unrecognized control command bytestring: ${bytestring}`);
}

const ESC = "\u001b";
type SequenceItem =
  | {type: "text"; value: string}
  | {type: "control_command"; value: ColorControlCommand}
  | {type: "error"; message: string};
// Basically, each control sequence is a command changing terminal state. We leave off the state
// machine side of things for now, and only process control sequences to commands
function parseTerminalControlSequences(input: string): Array<SequenceItem> {
  const sequence: Array<SequenceItem> = [];

  let currentText = "";
  for (let i = 0; i < input.length; i++) {
    let c = input[i];
    if (c == ESC && input[i + 1] == "[") {
      // End the current text
      if (currentText.length > 0) {
        sequence.push({type: "text", value: currentText});
        currentText = "";
      }

      // Skip ESC and [
      i += 2;
      let escapeInner = "";
      while (input[i] != "m") {
        escapeInner += input[i];
        i += 1;
      }

      const escapeCodes = escapeInner
        .split(";")
        .map(byteStringToControlCommand);
      for (const code of escapeCodes) {
        if (code.isError == false) {
          sequence.push({type: "control_command", value: code.value});
        } else {
          sequence.push({type: "error", message: code.message});
        }
      }
    } else {
      currentText += c;
    }
  }
  // Flush currentText
  if (currentText.length > 0) {
    sequence.push({type: "text", value: currentText});
  }

  return sequence;
}

const colorTable = {
  "30": "rgb(0, 0, 0)",
  "31": "rgb(170, 0, 0)",
  "32": "rgb(0, 170, 0)",
  "33": "rgb(170, 85, 0)",
  "34": "rgb(0, 0, 170)",
  "35": "rgb(170, 0, 170)",
  "36": "rgb(0, 170, 170)",
  "37": "rgb(170, 170, 170)",
  "90": "rgb(85, 85, 85)",
  "91": "rgb(255, 85, 85)",
  "92": "rgb(85, 255, 85)",
  "93": "rgb(255, 255, 85)",
  "94": "rgb(85, 85, 255)",
  "95": "rgb(255, 85, 255)",
  "96": "rgb(85, 255, 255)",
  "97": "rgb(255, 255, 255)",
};

function fgColorFromState(state): string {
  if (state.fgColor == null) {
    return "inherit";
  }

  let colorNum = state.fgColor;
  // This is actually probably not supported in most modern terminal emulators
  // if (state.isBold && colorNum < 38) {
  //   colorNum += 60;
  // }

  const color = colorTable[colorNum];
  if (color == null) {
    throw new Error("Unknown color code: " + colorNum);
  }
  return color;
}

function bgColorFromState(state): string {
  if (state.bgColor == null) {
    return "inherit";
  }

  let colorNum = state.bgColor;
  // This is actually probably not supported in most modern terminal emulators
  // if (state.isBold && colorNum < 48) {
  //   colorNum += 60;
  // }

  // bg to fg
  colorNum -= 10;

  const color = colorTable[colorNum];
  if (color == null) {
    console.log(state);
    throw new Error("Unknown color code: " + colorNum);
  }
  return color;
}

// shoutout to bjornd: https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Runs the actual state machine
function sequenceToHtml(sequence: ReadonlyArray<SequenceItem>): string {
  let html = "";

  let state = {
    bold: false,
    fgColor: null,
    bgColor: null,
  };

  for (const item of sequence) {
    if (item.type == "error") {
      console.error(item.message);
      continue;
    }
    if (item.type == "control_command") {
      if (item.value.cmd == "reset_all") {
        state = {
          bold: false,
          fgColor: null,
          bgColor: null,
        };
      } else if (item.value.cmd == "set_bold") {
        state.bold = true;
      } else if (item.value.cmd == "reset_fg_color") {
        state.fgColor = null;
      } else if (item.value.cmd == "reset_bg_color") {
        state.bgColor = null;
      } else if (item.value.cmd == "set_fg_color") {
        state.fgColor = item.value.color;
      } else if (item.value.cmd == "set_bg_color") {
        state.bgColor = item.value.color;
      }
      continue;
    }

    html += `<span style="color: ${fgColorFromState(
      state
    )}; background-color: ${bgColorFromState(state)}; font-weight: ${
      state.bold ? "bold" : "normal"
    }">${escapeHtml(item.value)}</span>`;
  }
  return html;
}

const DEMO_TEXT = `[0;1mdiff --git i/src/index.js w/src/index.js[0m
[0;1mindex 87d1be5..9a78c0a 100644[0m
[0;1m--- i/src/index.js[0m
[0;1m+++ w/src/index.js[0m
[0;36m@@ -1,10 +1,10 @@[0m
[0;31m-import React from 'react';[0m
[0;31m-import ReactDOM from 'react-dom';[0m
[0;31m-import './index.css';[0m
[0;31m-import App from './App';[0m
[0;31m-import * as serviceWorker from './serviceWorker';[0m
[0;32m+import React from "react";[0m
[0;32m+import ReactDOM from "react-dom";[0m
[0;32m+import "./index.css";[0m
[0;32m+import App from "./App.tsx";[0m
[0;32m+import * as serviceWorker from "./serviceWorker";[0m

[0;31m-ReactDOM.render(<App />, document.getElementById('root'));[0m
[0;32m+ReactDOM.render(<App />, document.getElementById("root"));
`;
function App() {
  function handleChange(event) {
    setHtml(
      sequenceToHtml(parseTerminalControlSequences(event.currentTarget.value))
    );
  }

  let input = useRef(null);

  useEffect(() => {
    if (input.current != null) {
      input.current.innerHTML = DEMO_TEXT;
      // HACK(zgotsch): too lazy to make this a controlled component
      handleChange({currentTarget: input.current});
    }
  }, []);

  let [warning, setWarning] = useState();
  let [html, setHtml] = useState("");
  return (
    <main>
      {warning != null ? <div className="warning">{warning}</div> : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
          columnGap: "0.5em",
          height: "100%",
        }}
      >
        <div className="column-container">
          <h2>Paste text containing terminal control sequences here</h2>
          <textarea
            onChange={handleChange}
            style={{width: "100%", flexGrow: 1}}
            ref={input}
          />
        </div>
        <div className="column-container">
          <h2>See a preview here</h2>
          <pre
            className="terminal"
            style={{flexGrow: 1}}
            dangerouslySetInnerHTML={{__html: html}}
          />
        </div>
        <div className="column-container">
          <h2>And see html with style attributes here</h2>
          <pre className="html-output" style={{flexGrow: 1}}>
            {html}
          </pre>
        </div>
      </div>
    </main>
  );
}

export default App;
