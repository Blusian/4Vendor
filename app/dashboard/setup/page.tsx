import type { Metadata } from "next";

import {
  createChannelAction,
  createItemAction,
  updateWorkspaceAction,
} from "../actions";
import {
  channelTypeOptions,
  formatCurrency,
  formatLabel,
  formatPercentFromBps,
  inventoryTypeOptions,
  loadDashboardData,
  paymentMethodOptions,
  taxModeOptions,
} from "../data";
import styles from "../dashboard.module.css";
import { BackendSetupCard, DashboardNoticeBanner, DashboardPageIntro } from "../shared";

export const metadata: Metadata = {
  title: "Dashboard Setup | 4Vendor",
  description: "Manage workspace settings, catalog items, and sales channels.",
};

export default async function DashboardSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const data = await loadDashboardData();

  if (data.backendMissing) {
    return (
      <>
        <DashboardNoticeBanner notice={params.notice} />
        <BackendSetupCard />
      </>
    );
  }

  return (
    <>
      <DashboardNoticeBanner notice={params.notice} />

      <section className={styles.gridSection}>
        <DashboardPageIntro
          eyebrow="Setup"
          title="Configure the workspace once, then let the ledger reuse it everywhere."
          text="This page keeps your shop profile, item catalog, and sales channels separate from daily transaction work."
        />

        <div className={styles.builderGrid}>
          <article className={styles.panel} id="workspace">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Workspace</p>
                <h2>Vendor profile</h2>
              </div>
              <span className={styles.badgeMuted}>{data.vendor ? "Live record" : "Creates on save"}</span>
            </div>

            <form action={updateWorkspaceAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Business name</span>
                  <input name="business_name" defaultValue={data.workspaceName} required />
                </label>
                <label className={styles.field}>
                  <span>Timezone</span>
                  <input name="timezone" defaultValue={data.vendor?.timezone ?? "America/Phoenix"} required />
                </label>
                <label className={styles.field}>
                  <span>Base currency</span>
                  <input name="base_currency" defaultValue={data.vendor?.base_currency ?? "USD"} maxLength={3} required />
                </label>
              </div>
              <button className={styles.primaryButton} type="submit">
                Save workspace
              </button>
            </form>
          </article>

          <article className={styles.panel} id="catalog">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Catalog</p>
                <h2>Add an item</h2>
              </div>
              <span className={styles.badgeMuted}>{data.items.length} items</span>
            </div>

            <form action={createItemAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>SKU</span>
                  <input name="sku" placeholder="PKM-UMB-VMAX-AA" required />
                </label>
                <label className={styles.field}>
                  <span>Item name</span>
                  <input name="name" placeholder="Umbreon VMAX Alt Art" required />
                </label>
                <label className={styles.field}>
                  <span>Set name</span>
                  <input name="set_name" placeholder="Evolving Skies" />
                </label>
                <label className={styles.field}>
                  <span>Set code</span>
                  <input name="set_code" placeholder="EVS" />
                </label>
                <label className={styles.field}>
                  <span>Inventory type</span>
                  <select name="inventory_type" defaultValue="single">
                    {inventoryTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Rarity</span>
                  <input name="rarity" placeholder="Alt Art" />
                </label>
                <label className={styles.field}>
                  <span>Condition</span>
                  <input name="condition" placeholder="Near Mint" />
                </label>
                <label className={styles.field}>
                  <span>Language</span>
                  <input name="language" defaultValue="en" />
                </label>
                <label className={styles.field}>
                  <span>Market price ($)</span>
                  <input name="market_price" type="number" step="0.01" min="0" placeholder="52.00" />
                </label>
                <label className={styles.field}>
                  <span>Market source</span>
                  <input name="market_price_source" placeholder="TCGplayer low" />
                </label>
              </div>
              <label className={styles.field}>
                <span>Notes</span>
                <textarea name="notes" rows={3} placeholder="Optional catalog notes for this item." />
              </label>
              <button className={styles.primaryButton} type="submit">
                Create item
              </button>
            </form>
          </article>

          <article className={styles.panel} id="channels">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Channels</p>
                <h2>Configure a sales lane</h2>
              </div>
              <span className={styles.badgeMuted}>{data.channels.length} channels</span>
            </div>

            <form action={createChannelAction} className={styles.formStack}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Channel name</span>
                  <input name="name" placeholder="Weekly card show" required />
                </label>
                <label className={styles.field}>
                  <span>Channel type</span>
                  <select name="channel_type" defaultValue="booth">
                    {channelTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Payment method</span>
                  <select name="payment_method" defaultValue="card">
                    {paymentMethodOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Tax mode</span>
                  <select name="default_tax_mode" defaultValue="none">
                    {taxModeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Default tax rate (%)</span>
                  <input name="default_tax_rate_percent" type="number" step="0.01" min="0" placeholder="8.25" />
                </label>
                <label className={styles.field}>
                  <span>Processor name</span>
                  <input name="processor_name" placeholder="Square" />
                </label>
                <label className={styles.field}>
                  <span>Fee label</span>
                  <input name="fee_label" placeholder="Card processor" />
                </label>
                <label className={styles.field}>
                  <span>Fee rate (%)</span>
                  <input name="fee_percent" type="number" step="0.01" min="0" placeholder="2.75" />
                </label>
                <label className={styles.field}>
                  <span>Flat fee ($)</span>
                  <input name="flat_fee" type="number" step="0.01" min="0" placeholder="0.30" />
                </label>
              </div>
              <div className={styles.checkboxRow}>
                <label className={styles.checkboxLabel}>
                  <input name="applies_to_tax" type="checkbox" />
                  <span>Fee applies to tax</span>
                </label>
                <label className={styles.checkboxLabel}>
                  <input name="applies_to_shipping" type="checkbox" />
                  <span>Fee applies to shipping</span>
                </label>
              </div>
              <button className={styles.primaryButton} type="submit">
                Create channel
              </button>
            </form>
          </article>
        </div>
      </section>

      <section className={styles.reportGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Catalog detail</p>
              <h2>Current items</h2>
            </div>
            <span className={styles.badgeMuted}>{data.items.length} items</span>
          </div>

          {data.items.length ? (
            <div className={styles.listStack}>
              {data.items.map((item) => {
                const inventoryRow = data.inventoryByItemId.get(item.id);

                return (
                  <div className={styles.listRow} key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>
                        {item.sku} / {item.set_name ?? "No set"} / {formatLabel(item.inventory_type)}
                      </p>
                    </div>
                    <div className={styles.listMetrics}>
                      <span>{inventoryRow ? `${inventoryRow.on_hand_quantity ?? 0} on hand` : "No stock yet"}</span>
                      <span>{inventoryRow ? formatCurrency(inventoryRow.weighted_unit_cost_cents) : "No cost yet"}</span>
                      <span>
                        {item.marketPriceCents !== null ? `${formatCurrency(item.marketPriceCents)} market` : "No market price"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No catalog items yet</strong>
              <p>Add your first item to unlock purchases, sales, and inventory adjustments.</p>
            </div>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.panelLabel}>Channel setup</p>
              <h2>Taxes and fee defaults</h2>
            </div>
            <span className={styles.badgeMuted}>{data.channels.length} channels</span>
          </div>

          {data.channels.length ? (
            <div className={styles.listStack}>
              {data.channels.map((channel) => (
                <div className={styles.listRow} key={channel.id}>
                  <div>
                    <strong>{channel.name}</strong>
                    <p>
                      {formatLabel(channel.channel_type)} / {formatLabel(channel.payment_method)} /{" "}
                      {formatLabel(channel.default_tax_mode)}
                    </p>
                  </div>
                  <div className={styles.listMetrics}>
                    <span>{formatPercentFromBps(channel.default_tax_rate_bps)} tax default</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>No channels configured</strong>
              <p>Create a booth, marketplace, online, or store channel to automate default tax and fee handling.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
