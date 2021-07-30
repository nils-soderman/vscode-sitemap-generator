import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './settings';
import * as generator from './sitemap-generator';

export function activate(context: vscode.ExtensionContext) {

	// New Command
	context.subscriptions.push(
		vscode.commands.registerCommand('sitemap-generator.new', async () => {
			NewSitemap();
		})

	);

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

	// On File Save
	vscode.workspace.onDidSaveTextDocument(async (Document: vscode.TextDocument) => {
		if (Document.uri.scheme === "file") {
			if (settings.IsSettingsFile(Document.uri.fsPath)) {
				const UserSelection = await vscode.window.showInformationMessage(
					`Settings have been updated, would you like to re-generate the sitemap?`, 
					"Re-Generate", 
					"Abort"
				);
				if (UserSelection === "Re-Generate")
					RegenerateSitemap();
			}
		}
	});

}

export function deactivate() { }


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
		const Sitemaps = settings.GetSitemaps();
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

