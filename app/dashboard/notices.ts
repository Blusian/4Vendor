export const dashboardNotices = {
  "adjustment-error": {
    description: "The inventory adjustment did not post. Check the item, quantity, and reason code, then try again.",
    title: "Adjustment not recorded",
    tone: "error",
  },
  "adjustment-recorded": {
    description: "The inventory adjustment has been posted to the ledger and the stock views are refreshed.",
    title: "Adjustment recorded",
    tone: "success",
  },
  "channel-created": {
    description: "The sales channel is live and any fee rule you entered is now part of the backend setup.",
    title: "Channel created",
    tone: "success",
  },
  "channel-error": {
    description: "The channel could not be saved. Review the channel details and try again.",
    title: "Channel not created",
    tone: "error",
  },
  "channel-exists": {
    description: "That channel name already exists for this workspace. Use a different name or update the existing one later.",
    title: "Channel already exists",
    tone: "error",
  },
  "demo-error": {
    description: "The demo workspace could not be seeded. Make sure the backend migrations are applied and try again.",
    title: "Demo data failed",
    tone: "error",
  },
  "demo-loaded": {
    description: "Sample items, lots, fees, and transactions were posted so the dashboard can show a full workflow.",
    title: "Demo ledger loaded",
    tone: "success",
  },
  "inventory-shortage": {
    description: "There is not enough available inventory to complete that action. Add stock first or reduce the quantity.",
    title: "Not enough inventory",
    tone: "error",
  },
  "item-created": {
    description: "The item is now available for purchases, sales, and adjustments throughout the dashboard.",
    title: "Catalog item created",
    tone: "success",
  },
  "item-error": {
    description: "The item could not be created. Review the catalog fields and try again.",
    title: "Item not created",
    tone: "error",
  },
  "item-exists": {
    description: "That SKU already exists in this workspace. Choose a different SKU or edit the existing item later.",
    title: "SKU already exists",
    tone: "error",
  },
  "market-price-error": {
    description: "The market benchmark could not be saved. Check the item and price, then try again.",
    title: "Market benchmark not saved",
    tone: "error",
  },
  "market-price-saved": {
    description: "The item now has a market benchmark, so the reports page can compare sale price against market price.",
    title: "Market benchmark saved",
    tone: "success",
  },
  "purchase-error": {
    description: "The purchase intake did not post. Review the item, quantity, and cost values, then try again.",
    title: "Purchase not recorded",
    tone: "error",
  },
  "purchase-recorded": {
    description: "The intake created inventory lots and movement records, so the stock position is immediately updated.",
    title: "Purchase recorded",
    tone: "success",
  },
  "reversal-error": {
    description: "The transaction could not be reversed. Choose a valid finalized transaction and try again.",
    title: "Reversal failed",
    tone: "error",
  },
  "reversal-exists": {
    description: "That transaction already has a finalized reversal on the books, so it cannot be reversed again.",
    title: "Already reversed",
    tone: "error",
  },
  "sale-error": {
    description: "The sale did not post. Review the item, quantity, price, and channel, then try again.",
    title: "Sale not recorded",
    tone: "error",
  },
  "sale-recorded": {
    description: "The sale is now reflected in inventory, fees, taxes, payouts, and profit reporting.",
    title: "Sale recorded",
    tone: "success",
  },
  "transaction-reversed": {
    description: "A reversal entry was posted and linked to the original finalized transaction.",
    title: "Transaction reversed",
    tone: "success",
  },
  "workspace-error": {
    description: "The workspace settings could not be saved. Check the business name and timezone, then try again.",
    title: "Workspace not updated",
    tone: "error",
  },
  "workspace-saved": {
    description: "Your vendor profile is now synced with the backend and will be used across new ledger entries.",
    title: "Workspace updated",
    tone: "success",
  },
} as const;

export type DashboardNoticeCode = keyof typeof dashboardNotices;
