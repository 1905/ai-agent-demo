import parse from 'css-tree/parser';
import { tokenize, tokenTypes as T } from 'css-tree/tokenizer';

export function validateThemeCss(css) {
  if (typeof css !== 'string' || !css.trim()) throw new Error('Provide a non-empty stylesheet.');
  if (css.length > 200_000) throw new Error('Keep the stylesheet under 200,000 characters.');
  try {
    // Browsers recover from unfinished blocks at EOF. Reject those here so a
    // truncated model response cannot quietly replace a working stylesheet.
    const closes = new Map([[T.LeftCurlyBracket, T.RightCurlyBracket], [T.LeftSquareBracket, T.RightSquareBracket], [T.LeftParenthesis, T.RightParenthesis], [T.Function, T.RightParenthesis]]);
    const closing = new Set(closes.values()), stack = [];
    tokenize(css, (type, start, end) => {
      if (type === T.BadString || type === T.BadUrl) throw Object.assign(new Error('Invalid string or URL'), { offset: start });
      if (type === T.Comment && !css.slice(start, end).endsWith('*/')) throw Object.assign(new Error('Unclosed comment'), { offset: start });
      if (closes.has(type)) stack.push({ type: closes.get(type), offset: start });
      else if (closing.has(type) && stack.pop()?.type !== type) throw Object.assign(new Error('Unmatched closing bracket'), { offset: start });
    });
    if (stack.length) throw Object.assign(new Error('Unclosed CSS block or function'), { offset: stack.at(-1).offset });
    parse(css, { onParseError: error => { throw error; } });
  } catch (error) {
    const line = error.line || css.slice(0, error.offset || 0).split('\n').length;
    throw new Error(`CSS error at line ${line}: ${error.message}. No changes applied.`);
  }
}
