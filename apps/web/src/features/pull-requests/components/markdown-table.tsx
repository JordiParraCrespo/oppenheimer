import type { Tokens } from 'marked';
import { columnSizes } from '../lib/markdown';
import { inlineTokens } from './markdown-inline';

/**
 * A description's table: full width, header rule, a hairline between rows,
 * each column capped by its longest cell, and its own scroll when it is
 * wider than the page.
 */
export function MarkdownTable({ table }: { table: Tokens.Table }) {
  const sizes = columnSizes(table);
  return (
    <div className="overflow-x-auto">
      <table>
        <thead>
          <tr>
            {table.header.map((cell, column) => {
              const key = `header-${column}`;
              return (
                <th key={key} align={cell.align ?? undefined} data-col-size={sizes[column]}>
                  {inlineTokens(cell.tokens, key)}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => {
            const rowKey = `row-${rowIndex}`;
            return (
              <tr key={rowKey}>
                {row.map((cell, column) => {
                  const key = `${rowKey}-${column}`;
                  return (
                    <td key={key} align={cell.align ?? undefined} data-col-size={sizes[column]}>
                      {inlineTokens(cell.tokens, key)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
