import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(path.join(root, 'frontend/package.json'))('typescript');
// Accept only literals, static references, arrays and object properties; never execute source code.
function readConstants(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (source.parseDiagnostics.length) throw new Error('TypeScript inválido');
  const declarations = new Map();
  for (const item of source.statements) {
    if (ts.isImportDeclaration(item) && item.importClause?.name) {
      const absolute = path.resolve(path.dirname(file), item.moduleSpecifier.text);
      const relative = path.relative(path.join(root, 'frontend/public'), absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Asset fora de public');
      declarations.set(item.importClause.name.text, '/' + relative.split(path.sep).join('/'));
    }
    if (ts.isVariableStatement(item)) for (const decl of item.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) throw new Error('Declaração não suportada');
      declarations.set(decl.name.text, decl.initializer);
    }
  }
  const stack = new Set();
  function evaluate(node) {
    if (typeof node === 'string') return node;
    if (!node) throw new Error('Declaração ausente');
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return evaluate(node.expression);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) {
      if (!declarations.has(node.text) || stack.has(node.text)) throw new Error(`Referência inválida: ${node.text}`);
      stack.add(node.text); const result = evaluate(declarations.get(node.text)); stack.delete(node.text); return result;
    }
    if (ts.isPropertyAccessExpression(node)) {
      const object = evaluate(node.expression);
      if (!Object.hasOwn(object, node.name.text)) throw new Error('Propriedade inexistente');
      return object[node.name.text];
    }
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(evaluate);
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property) || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) throw new Error('Propriedade não suportada');
        const key = property.name.text;
        if (Object.hasOwn(result, key) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Propriedade inválida');
        result[key] = evaluate(property.initializer);
      }
      return result;
    }
    throw new Error(`Expressão não permitida: ${ts.SyntaxKind[node.kind]}`);
  }
  return name => evaluate(declarations.get(name));
}
const story = readConstants(path.join(root, 'frontend/src/data/stories/chapeuzinho-vermelho.ts'))('chapeuzinhoVermelho');
const collections = readConstants(path.join(root, 'frontend/src/data/collectionPresentation.ts'))('collectionPresentations');
const collection = collections.find(c => c.id === story.collectionId);
if (!collection) throw new Error('Coleção não encontrada');
const target = path.join(root, 'backend/content/chapeuzinho-vermelho.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify({ version: 1, story, collection }, null, 2) + '\n', 'utf8');
console.log('Inventário exportado sem executar código TypeScript.');
