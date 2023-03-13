// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// '{' BODY ', ' OPTIONS ', ' TRANSFORMATIONS '}'
function checkKeyValPair(obj: unknown, isValidKey: (x: string) => boolean, isValidValue: (x: unknown) => boolean) {
	if (!obj || typeof obj !== 'object' || Object.keys(obj).length !== 1) { return false; }
	const [key, val] = Object.entries(obj)[0];
	return isValidKey(key) && isValidValue(val);
}


function isObject(x: string) {
	return x.startsWith("'{") && x.endsWith("}'");
}

function handleObject(title: string, body: string) {
	const targets = body.substring(3, body.length - 3).split("', '").map(x => x.trim()).map(x => {
		if (!x.includes(":")) { return x; }
		// find key, find value, return '{key: value}'
		// applykey ': {' APPLYTOKEN ':' KEY '}
		return '{key: value}';
	});

	// const key = body.split(' ')[0].replace(":{", '');
	const varName = title.toLowerCase();
	const fn = `function is${title}(${varName}: unknown): ${varName} is ${title} {
	const targets = [${targets.join(", ")}]
	return checkObject(${varName}, targets);
}`;
	// '{' BODY ', ' OPTIONS '}'
	return [`type ${title} = ${targets.join(" & ")}`, fn];
}

function isRegex(str: string) {
	try {
		if (!str.startsWith('[')) { return false; }
		const regex = new RegExp(str);
		regex.test('test');
		return true;
	} catch (e) {
		return false;
	}
}

function isDefinedKeyObject(body: string) {
	return body.endsWith("'}'") && body.includes(":{'") && !body.includes("':{'") && body.startsWith("'");
}

function handleDefinedKeyObject(title: string, body: string) {
	const key = body.split(':')[0].substring(1).trim();
	// const key = body.split(' ')[0].replace(":{", '');
	const varName = title.toLowerCase();
	const start = body.indexOf("{'");
	const end = body.indexOf("'}'");
	const types = body.substring(start + 2, end).split("', '").map(x => x.trim());

	return `interface ${title} {
	${key}: ${types.join(' & ')};
}

function is${title}(${varName}: unknown): ${varName} is ${title} {
	return checkKeyValPair(${varName}, (key) => key === '${key}', (v) => checkObject(${varName}, targets))
	if (!${varName} || typeof ${varName} !== 'object') return false;
	const entries = Object.entries(${varName});
	if (entries.length !== 1 || entries[0][0] !== '${key}' || !entries[0][1] || typeof entries[0][1] !== 'object') return false;
	const values = Object.entries(entries[0][1]);
	return ${types.map(t => `is${t}({${t}: entries[0][1].${t}})`)};
}
`;
}

// '{' FILTER '}' | '{' FILTER '}, ' FILTER_LIST
// function isArray(body: string) {
// 	const 
// 	return 
// }

function isString(str: string) {
	const s = str.trim();
	return ((s.startsWith("'") && s.endsWith("'") && !s.substring(1, s.length - 1).includes("'"))
		|| (s.startsWith('"') && s.endsWith('"')) && !s.substring(1, s.length - 1).includes('"'));
}

function handleStrings(title: string, body: string, functions: string[]) {
	const parts = body.split("|").map(x => x.trim());
	const varName = title.toLowerCase();
	functions.push(`function is${title}(${varName}: unknown): ${varName} is ${title} {
	return ${parts.map(x => varName + ' === ' + x).join('\n\t|| ')}
}`);
	return `type ${title} = ${body}`;
}

function handleRegex(title: string, body: string) {
	const varName = title.toLowerCase();
	return `type ${title} = string;

function is${title}(${varName}: unknown): ${varName} is ${title} {
	return typeof ${varName} === 'string' && new RegExp(/^(${body})$/).test(${varName});
}
`;
}


// function isObject(x: string) {
// 	const split = x.split(' ');
// 	return isString(split[0]) && isString(split[split.length-1]) && (x.match(/:\{'/g) || []).length === 1 && (x.match(/'\}'/g) || []).length === 1;
// }
// function handleObject(title: string, body: string) {
// 	const key = 
// 	const split = body.split(' ').map(x=>{
// 		if (isString(x)) {
// 			return x.substring(0, x.length-1);
// 		}
// 	})
// 	return `interface ${title} {
// 	WHERE: 
// }`
// }

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ebnf-to-typescript" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	// let disposable = vscode.commands.registerCommand('ebnf-to-typescript.helloWorld', () => {
	// 	// The code you place here will be executed every time your command is executed
	// 	vscode.workspace.openTextDocument(uri).then((document) => {
	// 		let text = document.getText();
	// 	  });
	// 	// Display a message box to the user
	// 	vscode.window.showInformationMessage('Hello World from EBNF-To-Typescript!');
	// });

	// context.subscriptions.push(disposable);

	const disposable = vscode.commands.registerCommand('extension.convertEBNFToTypescript', function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const selection = editor.selection;

			// Get the word within the selection
			const text = document.getText(selection);
			const lines = text.split('\n');
			const validationMap = {};
			const res = Array.from(Array(lines.length));
			const functions: string[] = [
				`function checkKeyValPair(obj: unknown, isValidKey: (x: string) => boolean, isValidValue: (x: unknown) => boolean) {
	if (!obj || typeof obj !== 'object' || Object.keys(obj).length !== 1) { return false; }
	const [key, val] = Object.entries(obj)[0];
	return isValidKey(key) && isValidValue(val);
}`,
				`function checkObject(obj: unknown, targets: string[]) {
	if (!obj || typeof obj !== 'object') { return false; }
	const entries = Object.entries(obj);
	for (let t of targets) {
		if (t.includes(":")) {
			// applykey ': {' APPLYTOKEN ':' KEY '}
			// TODO
		} else {
			const name = t.endsWith('?') ? t.substring(0, t.length - 1) : t
			const index = entries.findIndex(validationMap[name]);
			if (index > -1) { // only splice array when item is found
				entries.splice(index, 1); // 2nd parameter means remove one item only
			} else {
				if (!t.endsWith('?')) {
					return false;
				}
			}
		}
	}
	return entries.length === 0;
}`,


			];
			// const lines = text.split('\n');
			for (let i = 0; i < lines.length; i++) {
				if (!lines[i].includes('::=')) {
					continue;
				}
				let end = lines[i].indexOf("//");
				if (end < 0) { end = lines[i].length; }
				const line = lines[i].substring(0, end);
				const [title, body] = line.split("::=").map(x => x.trim());
				const parts = body.split("|").map(x => x.trim());
				if (parts.every(isString)) {
					res[i] = handleStrings(title, body, functions);
				}
				else if (isRegex(body)) {
					res[i] = handleRegex(title, body);
				}
				else if (parts.every(isString)) {
					const str1 = body.replace(/'\{'/g, '');
					const str2 = str1.replace(/'\}'/g, '');
					res[i] = `type ${title} = ${str2}`;
				}
				else if (isObject(body)) {
					handleObject(title, body);
				}
				else if (isDefinedKeyObject(body)) {
					res[i] = handleDefinedKeyObject(title, body);
				}
				else {
					res[i] = `type ${title} = {\n\ttodo\n}`;
				};
			}
			const result = res.join('\n') + '\n\n' + functions.join('\n');
			// vscode.window.showInformationMessage(result);
			editor.edit(editBuilder => {
				editBuilder.replace(selection, result);
			});
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
