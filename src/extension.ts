import * as vscode from 'vscode';
import * as path from 'path';
import * as settings from './settings';
import * as generator from './sitemap-generator';

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(
		vscode.commands.registerCommand('sitemap-generator.new', async () => {
			const WebsiteRoot = await ChoseRootDirectory();
			if (!WebsiteRoot)
				return;

			const Protocol:any = await vscode.window.showQuickPick(["http", "https"], {placeHolder: "Select a protocol", title: "Protocol:"});
			if (!Protocol)
				return;
				
			const DomainName = await vscode.window.showInputBox({title: "Domain Name", placeHolder: 'Enter your doman name. like: "example.com"'});
			if (!DomainName)
				return;
				
			const SitemapFilename = WebsiteRoot + "/sitemap.xml";
			const RelativeSitemapFilepath = path.relative(generator.GetWorkspaceFolder(), SitemapFilename);
			settings.SetSitemapSetting(RelativeSitemapFilepath, {Protocol: Protocol, DomainName: DomainName});

			generator.GenerateSiteMap(RelativeSitemapFilepath);
			OpenFile(SitemapFilename);
		})
	);

}

export function deactivate() {}


/**
 * Ask user where the root of the website is
 * @async
 */
async function ChoseRootDirectory(){
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
function OpenFile(Filepath:string) {
	vscode.workspace.openTextDocument(Filepath).then(
		TextDocument => vscode.window.showTextDocument(TextDocument)
	);
}

