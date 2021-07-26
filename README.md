Paste some code with ANSI terminal escape codes and get HTML with inline styles matching those colors.

Currently supported escape codes:
- resets (`]0m`, `]39m`, `]49m`)
- bold (`]1m`)
- foreground colors 30-37 and bright colors 90-97 (e.g. `]34m`)
- backgound colors 40-47 and bright colors 100-107 (e.g. `]45m`)

The current RGB values are from the VGA column of https://www.wikiwand.com/en/ANSI_escape_code and they are pretty ugly. It would be nice to allow users to choose a theme or input custom colors.
