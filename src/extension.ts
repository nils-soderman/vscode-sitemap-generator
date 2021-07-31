import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './settings';
import * as generator from './sitemap-generator';

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

	// Update
	context.subscriptions.push(
		vscode.commands.registerCommand('sitemap-generator.update', async () => {
			RegenerateSitemap();
		})
	);


	/* EVENTS */

	// On File Save
	vscode.workspace.onDidSaveTextDocument(async (Document: vscode.TextDocument) => {
		if (Document.uri.scheme === "file") {
			if (settings.IsSettingsFile(Document.uri.fsPath)) {
				CachedSitemapSettings = settings.ReadSettings();
				_UpdateEvenetListenerList();
				const UserSelection = await vscode.window.showInformationMessage(
					`Settings have been updated, would you like to re-generate the sitemap?`,
					"Re-Generate",
					"Abort"
				);
				if (UserSelection === "Re-Generate")
					RegenerateSitemap();
			}
			else if (SitemapsAutoUpdate) {
				SitemapsAutoUpdate.forEach(Sitemap => {
					if (ShouldFileChangeUpdateSitemap(Sitemap, Document.uri.fsPath)) {
						generator.OnFileSaved(Sitemap, Document.uri.fsPath);
					}
				});
			}
		}
	});

	function _UpdateEvenetListenerList() {
		SitemapsAutoUpdate = [];
		for (const Sitemap in CachedSitemapSettings) {
			if (settings.GetSitemapSettings(Sitemap, CachedSitemapSettings).bAutomaticallyUpdateSitemap) {
				ActivateEventListener();
				SitemapsAutoUpdate.push(Sitemap);
			}
		}
	}
	_UpdateEvenetListenerList();


}


export function deactivate() { }


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

function ActivateEventListener() {
	if (AutoUpdateListenerEnabled)
		return;
	AutoUpdateListenerEnabled = true;

	// File Created
	vscode.workspace.onDidCreateFiles(async Event => {
		Event.files.forEach(FileUri => {
			if (FileUri.scheme === "file") {
				SitemapsAutoUpdate.forEach(Sitemap => {
					if (ShouldFileChangeUpdateSitemap(Sitemap, FileUri.fsPath)) {
						generator.OnFileAdded(Sitemap, FileUri.fsPath);
					}
				});
			}
		});
	});

	// Files Removed
	vscode.workspace.onDidDeleteFiles(async Event => {
		Event.files.forEach(FileUri => {
			if (FileUri.scheme === "file") {
				SitemapsAutoUpdate.forEach(Sitemap => {
					if (ShouldFileChangeUpdateSitemap(Sitemap, FileUri.fsPath)) {
						generator.OnFileRemoved(Sitemap, FileUri.fsPath);
					}
				});
			}
		});
	});

	// Files Renamed
	vscode.workspace.onDidRenameFiles(async Event => {
		Event.files.forEach(FileRename => {
			if (FileRename.oldUri.scheme === "file") {
				SitemapsAutoUpdate.forEach(Sitemap => {
					const bOldShouldTriggerUpdate = ShouldFileChangeUpdateSitemap(Sitemap, FileRename.oldUri.fsPath);
					console.log("bOldShouldTriggerUpdate: " + bOldShouldTriggerUpdate);
					const bNewShouldTriggerUpdate = ShouldFileChangeUpdateSitemap(Sitemap, FileRename.newUri.fsPath);
					console.log("bNewShouldTriggerUpdate: " + bNewShouldTriggerUpdate);
					if (bOldShouldTriggerUpdate && !bNewShouldTriggerUpdate) {
						generator.OnFileRemoved(Sitemap, FileRename.oldUri.fsPath);
					}
					else if (bNewShouldTriggerUpdate && bOldShouldTriggerUpdate) {
						generator.OnFileRenamed(Sitemap, FileRename.oldUri.fsPath, FileRename.newUri.fsPath);
					}
					else if (bNewShouldTriggerUpdate && !bOldShouldTriggerUpdate) {
						generator.OnFileRemoved(Sitemap, FileRename.oldUri.fsPath);
						generator.OnFileAdded(Sitemap, FileRename.newUri.fsPath);
					}
				});
			}
		});
	});

}


async function NewSitemap() {
	const WebsiteRoot = await ChoseRootDirectory();
	if (!WebsiteRoot)
		return false;

	const Protocol: any = await vscode.window.showQuickPick(["http", "https"], { placeHolder: "Select a protocol", title: "Protocol:" });
	if (!Protocol)
		return false;

	const DomainName = await vscode.window.showInputBox({ title: "Domain Name", placeHolder: 'Enter your doman name. like: "example.com"' });
	if (!DomainName)
		return false;

	const SitemapFilename = WebsiteRoot + "/sitemap.xml";
	const RelativeSitemapFilepath = path.relative(generator.GetWorkspaceFolder(), SitemapFilename);
	settings.SetSitemapSetting(RelativeSitemapFilepath, { Protocol: Protocol, DomainName: DomainName });

	generator.GenerateSiteMap(RelativeSitemapFilepath);
	OpenFile(SitemapFilename);
	return true;
}


async function RegenerateSitemap(Sitemap?: string) {
	if (!Sitemap) {
		const Sitemaps = Object.keys(CachedSitemapSettings);
		if (!Sitemaps) {
			const UserSelection = await vscode.window.showErrorMessage("No sitemap found, would you like to create a new one?", "Yes", "No");
			if (UserSelection === "Yes")
				return await NewSitemap();
		}

		if (Sitemaps.length > 1) {
			Sitemap = await vscode.window.showQuickPick(Sitemaps, { title: "Sitemap" });
			if (!Sitemap)
				return false;
		}
		else {
			Sitemap = Sitemaps[0];
		}
	}

	generator.GenerateSiteMap(Sitemap);
	vscode.window.showInformationMessage(`${Sitemap} has been updated.`);
	OpenFile(path.join(generator.GetWorkspaceFolder(), Sitemap));

	return true;
}


/**
 * Ask user where the root of the website is
 * @async
 */
async function ChoseRootDirectory() {
	const options: vscode.OpenDialogOptions = {
		title: "Set Website Root",
		openLabel: "Set Website Root",
		canSelectMany: false,
		canSelectFolders: true,
		canSelectFiles: false,
	};

	if (vscode.workspace.workspaceFolders)
		options.defaultUri = vscode.workspace.workspaceFolders[0].uri;

	const folderURI = await vscode.window.showOpenDialog(options);
	if (!folderURI)
		return undefined;

	return folderURI[0].fsPath;
}


/**
 * 
 * @param Filepath 
 */
function OpenFile(Filepath: string) {
	vscode.workspace.openTextDocument(Filepath).then(
		TextDocument => vscode.window.showTextDocument(TextDocument)
	);
}

