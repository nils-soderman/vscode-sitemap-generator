import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import * as generator from './sitemap-generator';
import * as settings from './settings';

let SitemapsAutoUpdate: string[] = [];
let AutoUpdateListenerEnabled = false;
let CachedSitemapSettings: settings.SitemapSettings[] = settings.ReadSettings();


export function activate(context: vscode.ExtensionContext) {

	/* COMMANDS */

	// New Command
	context.subscriptions.push(
		vscode.commands.registerCommand('sitemap-generator.new', async () => {
			NewSitemap();
		})
	);

	// Open Settings
	context.subscriptions.push(
		vscode.commands.registerCommand('sitemap-generator.openSettings', () => {
			const Filepath = settings.GetSettingsFilepath();
			OpenFile(Filepath);
		})
	);

	// Re-Generate sitemap
	context.subscriptions.push(
		vscode.commands.registerCommand('sitemap-generator.reGenerate', async () => {
			RegenerateSitemap();
		})
	);


	/* EVENTS */

	// On File Save
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async (Document: vscode.TextDocument) => {
			if (Document.uri.scheme === "file") {

				// Check if user saved the sitemap-generator.json settings file
				if (settings.IsSettingsFile(Document.uri.fsPath)) {

					// Re-Cache the settings
					CachedSitemapSettings = settings.ReadSettings();
					_UpdateEventListenerList();

					// Ask user if they would like to re-generate the sitemap
					const UserSelection = await vscode.window.showInformationMessage(
						`Settings have been updated, would you like to re-generate the sitemap?`,
						"Re-Generate",
						"Abort"
					);
					if (UserSelection === "Re-Generate")
						RegenerateSitemap();
				}

				// Check if any sitemaps has auto update enabled
				else if (SitemapsAutoUpdate) {
					SitemapsAutoUpdate.forEach(Sitemap => {
						// For every sitemap with auto update enalbed, check if we need to update the sitemap
						if (ShouldFileChangeUpdateSitemap(Sitemap, Document.uri.fsPath)) {
							generator.OnFileSaved(Sitemap, Document.uri.fsPath);
						}
					});
				}
			}
		})
	);

	/**
	 * Update the SitemapsAutoUpdate list with all sitemaps that have auto-update enabled
	 */
	function _UpdateEventListenerList() {
		SitemapsAutoUpdate = [];
		for (const Sitemap in CachedSitemapSettings) {
			if (settings.GetSitemapSettings(Sitemap, CachedSitemapSettings).bAutomaticallyUpdateSitemap) {
				SitemapsAutoUpdate.push(Sitemap);

				// Make sure event listeners are enabled
				if (!AutoUpdateListenerEnabled)
					ActivateEventListener(context);
			}
		}
	}
	_UpdateEventListenerList();

}


export function deactivate() {
	SitemapsAutoUpdate = [];
	CachedSitemapSettings = [];
}


/**
 * Check if filepath is in the scope of the sitemap. So it's e.g. not part of an exclude pattern
 * @param Sitemap Relative filepath to the sitemap from the workspace
 * @param Filepath The absolute filepath to the file that has changed
 * @returns whether the sitemap needs to be updated or not
 */
function ShouldFileChangeUpdateSitemap(Sitemap: string, Filepath: string) {
	const SitemapSettings = settings.GetSitemapSettings(Sitemap, CachedSitemapSettings);
	if (SitemapSettings.Root === undefined || SitemapSettings.Exclude === undefined)
		return false;

	// Check so file extetion of the file just saved is included in the sitemap settings
	if (!SitemapSettings.IncludeExt?.includes(path.extname(Filepath)))
		return false;

	const RelativeFilepath = path.relative(path.join(generator.GetWorkspaceFolder(), SitemapSettings.Root), Filepath).replace(/\\/g, "/");

	// Make sure file saved is under the root
	if (RelativeFilepath.startsWith(".."))
		return false;

	// Check if the file just saved is under a exclude filter
	for (const Pattern of SitemapSettings.Exclude) {
		if (RelativeFilepath.search(new RegExp(Pattern)) !== -1)
			return false;
	}

	return true;
}


/**
 * Activate event listeners that auto update the sitemaps when files are Created, Removed or Renamed.
 * @param context ExtentionContext to be able to push disposables
 */
function ActivateEventListener(context: vscode.ExtensionContext) {
	// Set this bool to true to ensure this function is never called on again
	AutoUpdateListenerEnabled = true;

	// File Created
	context.subscriptions.push(
		vscode.workspace.onDidCreateFiles(async Event => {
			Event.files.forEach(FileUri => {
				if (FileUri.scheme === "file") {
					SitemapsAutoUpdate.forEach(Sitemap => {
						// For each sitemap with auto-update enabled, check if we need to update the sitemap
						if (ShouldFileChangeUpdateSitemap(Sitemap, FileUri.fsPath)) {
							generator.OnFileAdded(Sitemap, FileUri.fsPath);
						}
					});
				}
			});
		})
	);

	// Files Removed
	context.subscriptions.push(
		vscode.workspace.onDidDeleteFiles(async Event => {
			Event.files.forEach(FileUri => {
				if (FileUri.scheme === "file") {
					SitemapsAutoUpdate.forEach(Sitemap => {
						// For each sitemap with auto-update enabled, check if we need to update the sitemap
						if (ShouldFileChangeUpdateSitemap(Sitemap, FileUri.fsPath)) {
							generator.OnFileRemoved(Sitemap, FileUri.fsPath);
						}
					});
				}
			});
		})
	);

	// Files Renamed
	context.subscriptions.push(
		vscode.workspace.onDidRenameFiles(async Event => {
			Event.files.forEach(FileRename => {
				if (FileRename.oldUri.scheme === "file") {
					SitemapsAutoUpdate.forEach(Sitemap => {
						const bOldShouldTriggerUpdate = ShouldFileChangeUpdateSitemap(Sitemap, FileRename.oldUri.fsPath);
						const bNewShouldTriggerUpdate = ShouldFileChangeUpdateSitemap(Sitemap, FileRename.newUri.fsPath);

						// If both urls was valid, trigger the rename function
						if (bNewShouldTriggerUpdate && bOldShouldTriggerUpdate) {
							generator.OnFileRenamed(Sitemap, FileRename.oldUri.fsPath, FileRename.newUri.fsPath);
						}

						// If only the old filepath was valid, remove the item from the sitemap
						else if (bOldShouldTriggerUpdate && !bNewShouldTriggerUpdate) {
							generator.OnFileRemoved(Sitemap, FileRename.oldUri.fsPath);
						}

						// If only the old filepath was valid, remove the file, then add a new one
						else if (bNewShouldTriggerUpdate && !bOldShouldTriggerUpdate) {
							generator.OnFileRemoved(Sitemap, FileRename.oldUri.fsPath);
							generator.OnFileAdded(Sitemap, FileRename.newUri.fsPath);
						}
					});
				}
			});
		})
	);

}


/**
 * Asks the user a few questions then generate a new sitemap
 * @returns true if sitemap was created, otherwise false
 * @async
 */
async function NewSitemap() {

	// TODO: Switch this dialog to a save as dialog ?
	const OpenDialogOptions: vscode.OpenDialogOptions = {
		title: "Set Website Root",
		openLabel: "Set Website Root",
		canSelectMany: false,
		canSelectFolders: true,
		canSelectFiles: false,
	};
	if (vscode.workspace.workspaceFolders)
		OpenDialogOptions.defaultUri = vscode.workspace.workspaceFolders[0].uri;

	// Ask user for the website root
	let WebsiteRootUris = await vscode.window.showOpenDialog(OpenDialogOptions);
	if (!WebsiteRootUris)
		return false;

	// Ask user to select a protocol
	const Protocol: any = await vscode.window.showQuickPick(["http", "https"], { placeHolder: "Select a protocol", title: "Protocol:" });
	if (!Protocol)
		return false;

	// Ask user to input the domain name
	const DomainName = await vscode.window.showInputBox({ title: "Domain Name", placeHolder: 'Enter your doman name. like: "example.com"' });
	if (!DomainName)
		return false;

	const AbsSitemapFilepath = WebsiteRootUris[0].fsPath + "/sitemap.xml";

	// Check if file already exists
	if (fs.existsSync(AbsSitemapFilepath)) {
		// Ask if user wants to overwrite existing file
		const UserSelection = await vscode.window.showWarningMessage(
			`Sitemap already exists:\n${AbsSitemapFilepath}\nWould you like to overwrite it?`,
			"Overwrite",
			"Abort"
		);
		if (UserSelection !== "Overwrite")
			return false;
	}


	const RelativeSitemapFilepath = path.relative(generator.GetWorkspaceFolder(), AbsSitemapFilepath);

	// Write default settings into the sitemap-generator.json file
	settings.SetSitemapSetting(RelativeSitemapFilepath, { Protocol: Protocol, DomainName: DomainName });

	generator.GenerateSiteMap(RelativeSitemapFilepath);

	// Open the sitemap in the editor
	OpenFile(AbsSitemapFilepath);

	return true;
}


/**
 * Re-Generate a sitemap
 * @param Sitemap Optional relative filepath to the sitemap from the workspace, if none is provided it'll be fetched automatically
 * @returns whether the sitemap was re-generated or not
 */
async function RegenerateSitemap(Sitemap?: string) {
	if (!Sitemap) {
		
		// Get all sitemaps in the settings file
		const Sitemaps = Object.keys(CachedSitemapSettings);

		// If no sitemaps exists, ask user if they want to create a new sitemap
		if (!Sitemaps) {
			const UserSelection = await vscode.window.showErrorMessage("No sitemap found, would you like to create a new one?", "Yes", "No");
			if (UserSelection === "Yes")
				return await NewSitemap();
		}

		// If multiple sitemaps exists, ask user which one they'd like to re-generate
		if (Sitemaps.length > 1) {
			Sitemap = await vscode.window.showQuickPick(Sitemaps, { title: "Sitemap" });
			if (!Sitemap)
				return false;
		}

		// If only one sitemap exists, use that one
		else {
			Sitemap = Sitemaps[0];
		}
	}

	// Re-generate the sitemap
	generator.GenerateSiteMap(Sitemap);

	// Ask if user wants to open the sitemap
	const UserSelection = await vscode.window.showInformationMessage(`${Sitemap} has been updated.`, "Open");
	if (UserSelection === "Open")
		OpenFile(path.join(generator.GetWorkspaceFolder(), Sitemap));

	return true;
}


/**
 * Opens a file in the editor
 * @param Filepath absolute filepath
 */
function OpenFile(Filepath: string) {
	vscode.workspace.openTextDocument(Filepath).then(
		TextDocument => vscode.window.showTextDocument(TextDocument)
	);
}

