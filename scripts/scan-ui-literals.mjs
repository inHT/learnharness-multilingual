// AST scan for suspicious user-visible English literals in TSX/TS/CJS UI files.
// Usage: node scan-ui-literals.mjs <file...>
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const args = process.argv.slice(2);
const files = [];
for (const arg of args) {
	if (fs.statSync(arg).isDirectory()) {
		const walk = (dir) => {
			for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
				const p = path.join(dir, ent.name);
				if (ent.isDirectory()) { if (!/node_modules|\.next|dist/.test(p)) walk(p); }
				else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(ent.name)) files.push(p);
			}
		};
		walk(arg);
	} else files.push(arg);
}
const SKIP_ATTRS = new Set([
	"className", "class", "id", "key", "href", "src", "type", "role", "name", "value",
	"variant", "size", "asChild", "side", "align", "target", "rel", "method", "action",
	"autoComplete", "inputMode", "lang", "dir", "xmlns", "viewBox", "fill", "stroke",
	"strokeWidth", "d", "rx", "ry", "cx", "cy", "r", "width", "height", "x", "y",
	"data-testid", "testid", "testId", "data-state", "data-side", "data-id", "data-kind",
	"preferredSide", "kind", "mode", "state", "status", "providerId", "logicalId", "envVar",
]);
const UI_ATTRS = new Set([
	"aria-label", "aria-description", "aria-roledescription", "placeholder", "title",
	"label", "hint", "alt", "headerTooltip", "viewLabel", "hideLabel", "emptyLabel",
	"subtitle", "description", "message", "heading", "body", "copy", "text", "tooltip",
	"viewBriefLabel", "hideBriefLabel", "ariaLabel",
]);
const UI_PROPS = new Set([
	"label", "title", "description", "hint", "placeholder", "message", "heading", "body",
	"copy", "text", "subtitle", "summary", "detail", "notice", "error", "empty", "tooltip",
	"emptyLabel", "viewLabel", "hideLabel", "headerTooltip", "alt", "ariaLabel",
	"viewBriefLabel", "hideBriefLabel", "prompt", "progress", "helper", "caption",
]);
const CALL_HINT = /^(set(Error|Notice|Message|Status|Hint|Progress|Warning|Text|Copy|Label|Prompt|Detail)|toast|alert|confirm|notify|showToast|pushToast|report)/;
const I18N_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)+$/;
const TECH = /^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/|[\w.-]+\.(?:json|tsx?|jsx?|mjs|cjs|css|md|png|svg|webp|jpg|jpeg|gif|woff2?|ttf|otf|pdf)$)/i;
const KNOWN_ACRONYM = /^(?:[A-Z]{2,}(?:\s|$)|[A-Za-z]+Icon\b)/;

const TAILWIND = /(^|\s)(flex|grid|block|inline|inline-flex|hidden|contents|relative|absolute|fixed|sticky|rounded[\w-]*|border[\w/-]*|bg-[\w/-]+|text-(?:xs|sm|base|lg|xl|\d|\[|left|center|right|muted|foreground|background|primary|secondary|error|success|accent|card|border|current)|font-[\w-]+|leading-[\w-]+|tracking-[\w-]+|p[xytblr]?-[\w./[\]-]+|m[xytblr]?-[\w./[\]-]+|w-[\w./[\]-]+|h-[\w./[\]-]+|min-[wh]-[\w./[\]-]+|max-[wh]-[\w./[\]-]+|gap-[\w./[\]-]+|items-[\w-]+|justify-[\w-]+|overflow-[\w-]+|shrink-[\w-]+|grow[\w-]*|size-[\w./[\]-]+|opacity-[\w-]+|transition[\w-]*|hover:[\w/-]+|focus(?:-within|-visible)?:[\w/-]+|disabled:[\w/-]+|aria-[\w-]+:[\w/-]+|group(?:-open)?:[\w/-]+|data-\[[^\]]+\]:[\w/-]+|cursor-[\w-]+|select-[\w-]+|pointer-events-[\w-]+|whitespace-[\w-]+|truncate|tabular-nums|sr-only|field-sizing-[\w-]+|lh-[\w-]+|uppercase|capitalize|outline-none|shadow[\w-]*|z-[\w-]+|inset-[\w-]+|top-[\w-]+|left-[\w-]+|right-[\w-]+|bottom-[\w-]+|col-[\w-]+|row-[\w-]+|space-[xy]-[\w-]+|divide-[\w/-]+|ring[\w-]*|fill-[\w/-]+|stroke-[\w/-]+|aspect-[\w-]+|object-[\w-]+|list-[\w-]+|break-[\w-]+|align-[\w-]+|self-[\w-]+|place-[\w-]+|order-[\w-]+|basis-[\w-]+|flex-[\w-]+)(\s|$)/;
function isEnglishish(text) {
	const t = text.trim();
	if (t.length < 2) return false;
	if (I18N_KEY.test(t)) return false;
	if (TECH.test(t)) return false;
	if (TAILWIND.test(t)) return false;
	if (/^(?:M|m)[\d\s.,-]+[A-Za-z]?[\d\s.,-]*$/.test(t)) return false; // svg path
	// needs a letter run of 2+ Latin letters, and at least one space or uppercase start
	if (!/[A-Za-z]{2,}/.test(t)) return false;
	if (!/\s/.test(t) && !/^[A-Z]/.test(t)) return false;
	return true;
}

function insideClassName(node) {
	let cur = node.parent;
	while (cur) {
		if (ts.isJsxAttribute(cur) && cur.name.getText().toLowerCase() === "classname") return true;
		if (ts.isPropertyAssignment(cur) && cur.name.getText().replace(/["']/g, "") === "className") return true;
		if (ts.isJsxElement(cur) || ts.isJsxSelfClosingElement(cur) || ts.isFunctionLike(cur)) return false;
		cur = cur.parent;
	}
	return false;
}

function report(rows, file, node, kind, text, extra = "") {
	const { line } = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart());
	rows.push({ file, line: line + 1, kind, text: text.replace(/\s+/g, " ").trim(), extra });
}

function literalText(node) {
	if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
	return null;
}

function scanFile(file) {
	const source = fs.readFileSync(file, "utf8");
	const ext = path.extname(file).toLowerCase();
	const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
		ext === ".cjs" || ext === ".js" || ext === ".mjs" ? ts.ScriptKind.JS : ext === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
	const rows = [];
	const seen = new Set();
	const add = (node, kind, text, extra) => {
		if (!text || !isEnglishish(text)) return;
		if (insideClassName(node)) return;
		const key = `${node.getStart()}|${text}`;
		if (seen.has(key)) return;
		seen.add(key);
		report(rows, file, node, kind, text, extra);
	};
	function visit(node) {
		if (ts.isJsxText(node)) {
			const text = node.text.replace(/\s+/g, " ").trim();
			if (text && isEnglishish(text) && !/^[{}]+$/.test(text)) add(node, "jsx-text", text);
		}
		if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
			const name = node.name.getText();
			if (!SKIP_ATTRS.has(name)) {
				const text = node.initializer.text;
				if (UI_ATTRS.has(name) || true) add(node.initializer, "attr:" + name, text);
			}
		}
		if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
			add(node.expression, "jsx-expr", node.expression.text);
		}
		if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
			const name = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
			if (UI_PROPS.has(name)) {
				const text = literalText(node.initializer);
				if (text !== null) add(node.initializer, "prop:" + name, text);
				else if (ts.isTemplateExpression(node.initializer)) add(node.initializer, "prop-template:" + name, node.initializer.getText());
			}
		}
		if (ts.isBindingElement(node) && node.propertyName && node.initializer) {
			const name = node.propertyName.getText();
			if (UI_PROPS.has(name)) {
				const text = literalText(node.initializer);
				if (text !== null) add(node.initializer, "default-prop:" + name, text);
			}
		}
		if (ts.isParameter(node) && node.initializer) {
			const name = node.name.getText();
			if (UI_PROPS.has(name)) {
				const text = literalText(node.initializer);
				if (text !== null) add(node.initializer, "default-param:" + name, text);
			}
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			const n = node.name.text;
			// exported UI copy constants are usually SCREAMING_CASE strings
			if (/^[A-Z][A-Z0-9_]{3,}$/.test(n)) {
				const text = literalText(node.initializer);
				if (text !== null) add(node.initializer, "const:" + n, text);
				else if (ts.isTemplateExpression(node.initializer)) add(node.initializer, "const-template:" + n, node.initializer.getText());
			}
		}
		if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			const fn = node.expression.text;
			if (CALL_HINT.test(fn)) {
				for (const arg of node.arguments) {
					const text = literalText(arg);
					if (text !== null) add(arg, "call:" + fn, text);
					else if (ts.isTemplateExpression(arg)) add(arg, "call-template:" + fn, arg.getText());
				}
			}
		}
		if (ts.isReturnStatement(node) && node.expression) {
			const text = literalText(node.expression);
			if (text !== null) add(node.expression, "return", text);
			else if (ts.isTemplateExpression(node.expression)) add(node.expression, "return-template", node.expression.getText());
			else if (ts.isConditionalExpression(node.expression)) {
				for (const branch of [node.expression.whenTrue, node.expression.whenFalse]) {
					const bt = literalText(branch);
					if (bt !== null) add(branch, "return-cond", bt);
					else if (ts.isTemplateExpression(branch)) add(branch, "return-cond-template", branch.getText());
				}
			}
		}
		if (ts.isConditionalExpression(node)) {
			for (const branch of [node.whenTrue, node.whenFalse]) {
				const bt = literalText(branch);
				if (bt !== null) add(branch, "ternary", bt);
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(sf);
	return rows;
}

let all = [];
for (const file of files) {
	try { all = all.concat(scanFile(file)); }
	catch (e) { console.error(`ERR ${file}: ${e.message}`); }
}
for (const r of all) console.log(`${r.file}:${r.line}\t${r.kind}\t${r.text}`);
console.error(`TOTAL ${all.length}`);
