# Sitemap Generator
Automatically generate sitemaps & keep them updated as you modify files.

<br>

## Usage

### Generating a new sitemap
1. Open your website's workspace / folder in VSCode.
2. Run the command `Sitemap-Generator: New Sitemap`
3. Select where to save the sitemap, select your prefered protocol and enter your domain name.
4. A sitemap will be generated & a new settings file named `sitemap-generator.json` will appear under the .vscode folder.

If you want to tweak the settings of the sitemap you can open `sitemap-generator.json` either manually or by running the command `Sitemap-Generator: Open Settings (JSON)`.<br>
By default the sitemap will automatically be updated as you add, remove or modify files _(this can be turned off in the sitemap-generator.json)_.

<br>

## Commands

|             Command Name                  |                  Description                      |
| ----------------------------------------- | ------------------------------------------------- |
| Sitemap-Generator: New Sitemap            | Creates a new sitemap based on a few user inputs  |
| Sitemap-Generator: Re-Generate Sitemap    | Re-Generate an already existing sitemap           |
| Sitemap-Generator: Open Settings (JSON)   | Opens the sitemap-generator.json settings file    |


<br>

## Options

When a new sitemap is created, a `sitemap-generator.json` file will be created under .vscode in the current workspace.
This file includes some tweakable settings to make format the sitemap as you want it.

|             Key             |       Type       |    Default Value      |           Description                                                                        |
| --------------------------- | ---------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| Protocol                    | http \| https    | "http"                | The protocol to be used, can be either http or https                                         |
| DomainName                  | string           | "example<span>.com"   | The name of your domain e.g. "example</span>.com"                                            |
| Root                        | string           | "./"                  | The relative path from the workspace to the website root where it should search for files    |
| IncludeExt                  | string[]         | [".html", ".php"]     | List of file extentions to count as urls. e.g. ".html"                                       |
| Exclude                     | string[]         | []                    | List of regex patterns of files to be excluded from the sitemap                              |
| bRemoveFileExtentions       | boolean          | false                 | Remove file extentions from the url                                                          |
| bIncludeWWW                 | boolean          | true                  | If the url should include "www." or not                                                      |
| bUseTrailingSlash           | boolean          | false                 | Should url's end with a trailing forward slash                                               |
| bAutomaticallyUpdateSitemap | boolean          | true                  | Will automatically keep the sitemap updated when modifying files                             |
| bMinimized                  | boolean          | false                 | Remove all whitespaces characters from the generated file to minimize the filesize           |

<br>

## Links

[Github Repository](https://github.com/nils-soderman/vscode-sitemap-generator)

<br>
Feel free to contact me if you have any questions or feature requests:

[Personal Website](https://nilssoderman.com)