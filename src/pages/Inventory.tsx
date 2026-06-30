import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Boxes, Plus } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { usePermissions } from "@/hooks/usePermissions";
import { useShop } from "@/contexts/ShopContext";
import { MovementHistoryTable } from "@/components/MovementHistoryTable";
import { StockAdjustmentDialog } from "@/components/StockAdjustmentDialog";
import { PageTip } from "@/components/PageTip";

export default function Inventory() {
  usePageMeta({ title: "Inventory Movements — UCU", description: "Track stock changes and make manual stock adjustments.", path: "/inventory" });
  const perms = usePermissions();
  const { currentShop } = useShop();
  const [adjOpen, setAdjOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!perms.canManageProducts) {
    return <div className="p-12 text-center text-muted-foreground">You don't have access to Inventory.</div>;
  }
  if (!currentShop) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Boxes className="size-7 text-primary" />Inventory</h1>
          <p className="text-muted-foreground mt-1">Full audit trail of every stock change.</p>
        </div>
        <Button onClick={() => setAdjOpen(true)}>
          <Plus className="size-4 me-1" /> New Adjustment
        </Button>
      </header>

      <PageTip id="inventory.intro" title="Stock changes are tracked automatically">
        Every sale, return, and purchase updates stock for you. Use <b>New Adjustment</b> only for things outside those flows —
        damage, theft, gifts, stock-take corrections. Every change here is logged with a reason and who did it.
      </PageTip>

      <Tabs defaultValue="history" className="space-y-4">

        <TabsList>
          <TabsTrigger value="history">Movement History</TabsTrigger>
        </TabsList>
        <TabsContent value="history">
          <MovementHistoryTable key={refreshKey} />
        </TabsContent>
      </Tabs>

      <StockAdjustmentDialog
        open={adjOpen}
        onOpenChange={setAdjOpen}
        onDone={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
