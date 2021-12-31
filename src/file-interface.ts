import { parse, Transaction, TransactionCache } from './parser';
import type { ISettings } from './settings';
import type { MetadataCache, TFile, Vault } from 'obsidian';

export const formatExpense = (tx: Transaction, settings: ISettings): string => {
  const symb = settings.currencySymbol;
  // The final line needs to have the amount updated so all lines total 0.
  const total = tx.value.expenselines
    .slice(0, -1)
    .map(({ amount }) => amount)
    .reduce((prev, curr) => curr + prev, 0);
  tx.value.expenselines[tx.value.expenselines.length - 1].amount = total * -1;

  const joinedLines = tx.value.expenselines
    .map(({ account, amount }, i) => {
      if (
        i !== tx.value.expenselines.length - 1 ||
        settings.includeFinalLineAmount
      ) {
        return `    ${account}    ${symb}${amount.toFixed(2)}`;
      }
      // The amount is optional on the final line
      return `    ${account}`;
    })
    .join('\n');
  return `\n${tx.value.date} ${tx.value.payee}\n${joinedLines}`;
};

export const appendLedger = async (
  cache: MetadataCache,
  vault: Vault,
  settings: ISettings,
  newExpense: string,
): Promise<void> => {
  const file = cache.getFirstLinkpathDest(settings.ledgerFile, '');
  if (file) {
    const fileContents = await vault.read(file);
    const newFileContents = `${fileContents}\n${newExpense}`;
    await vault.modify(file, newFileContents);
  } else {
    await vault.create(settings.ledgerFile, newExpense);
  }
};

export class LedgerModifier {
  private readonly vault: Vault;
  private ledgerFile: TFile;

  constructor(vault: Vault, ledgerFile: TFile) {
    this.vault = vault;
    this.ledgerFile = ledgerFile;
  }

  public setLedgerFile(ledgerFile: TFile): void {
    this.ledgerFile = ledgerFile;
  }

  public async deleteTransaction(tx: Transaction): Promise<void> {
    const fileContents = await this.vault.cachedRead(this.ledgerFile);
    const lines = fileContents.split('\n');
    lines.splice(
      tx.block.firstLine,
      tx.block.lastLine - tx.block.firstLine + 1,
    );
    return this.vault.modify(this.ledgerFile, lines.join('\n'));
  }
}

export const getTransactionCache = async (
  cache: MetadataCache,
  vault: Vault,
  settings: ISettings,
  ledgerFilePath: string,
): Promise<TransactionCache> => {
  const file = cache.getFirstLinkpathDest(ledgerFilePath, '');
  if (!file) {
    console.debug('Ledger: Unable to find Ledger file to parse');
    return undefined;
  }

  const fileContents = await vault.read(file);
  return parse(fileContents, settings);
};
