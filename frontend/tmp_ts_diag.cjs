const ts = require('typescript');
const fs = require('fs');
const file = 'src/components/Home.tsx';
const program = ts.createProgram([file], {
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ESNext,
  allowJs: false,
  noEmit: true,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
console.log('diag count', diagnostics.length);
for (const d of diagnostics) {
  if (!d.file) continue;
  const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
  console.log(`${d.file.fileName}:${line+1}:${character+1} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
}
