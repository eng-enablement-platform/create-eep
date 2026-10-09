import type { Rule } from 'eslint';

/*
 * Directive comment prefixes that must stay as block comments even on a single
 * line - converting `/* eslint-disable-next-line *\/` to `//` would change its
 * meaning or position semantics, so they are exempt.
 */
const DIRECTIVE_PREFIXES = [
  'eslint',
  'ts-',
  'prettier',
  'global',
  'globals',
  'istanbul',
  'c8',
  'v8',
  '@ts-',
];

/**
 * Whether a block comment's content is a tooling directive that must remain a
 * block comment (e.g. `eslint-disable-line`, `ts-expect-error`).
 *
 * @param value - The raw text inside the comment delimiters.
 * @returns `true` when the comment is a directive and should be skipped.
 */
const isDirective = (value: string): boolean => {
  const trimmed = value.trim();
  return DIRECTIVE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
};

/**
 * Local ESLint rule: single-line comments must use line syntax, never block
 * syntax.
 *
 * This is the missing half of the project comment contract. The stylistic
 * `multiline-comment-style` rule already forces multi-line comments into
 * starred blocks; this rule forces the other direction so a one-line comment
 * can never be a block comment. Together they make the style total: one line
 * is always a line comment, multiple lines are always a block comment.
 *
 * Exemptions: TSDoc and JSDoc comments (content starting with an asterisk) and
 * tooling directives (`eslint-*`, `ts-*`, and similar) keep their block form,
 * as do inline comments followed by code on the same line.
 *
 * Ported from eep-template-next-app, plus the inline-comment exemption.
 */
export const singleLineCommentStyle: Rule.RuleModule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'Enforce `//` for single-line comments, never `/* */`.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useLineComment:
        'Single-line comments must use `//`, not `/* */`. Reserve block comments for multi-line comments.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          // Only block comments can be wrongly single-lined; `//` is already fine.
          if (comment.type !== 'Block') {
            continue;
          }

          // Comments parsed by ESLint always carry location data; guard for the types.
          const { loc, range } = comment;
          if (!loc || !range) {
            continue;
          }

          // Multi-line blocks are owned by `multiline-comment-style` - skip them.
          if (loc.start.line !== loc.end.line) {
            continue;
          }

          // Leave TSDoc/JSDoc (`/** ... */`) untouched.
          if (comment.value.startsWith('*')) {
            continue;
          }

          // Leave tooling directives as block comments.
          if (isDirective(comment.value)) {
            continue;
          }

          /*
           * Leave inline comments with code after them on the same line
           * (e.g. `fn(/* retries *\/ 3)`) - converting those to `//` would
           * comment out the rest of the line and break the code.
           */
          const nextToken = sourceCode.getTokenAfter(comment, {
            includeComments: true,
          });
          if (nextToken?.loc?.start.line === loc.end.line) {
            continue;
          }

          context.report({
            loc,
            messageId: 'useLineComment',
            fix(fixer) {
              const text = comment.value.trim();
              return fixer.replaceTextRange(range, `// ${text}`);
            },
          });
        }
      },
    };
  },
};
