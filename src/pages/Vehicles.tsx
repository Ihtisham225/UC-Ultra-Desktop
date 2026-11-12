import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Car, CarFront } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isOil } from "@/lib/oil";
import VehiclesRegister from "@/components/VehiclesRegister";
import { VehicleHistoryDialog, type HistoryVehicle, type HistoryVisit } from "@/components/VehicleHistoryDialog";
import { useLocalStore } from "@/hooks/useLocalStore";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { getById } from "@/lib/localDb";
import { toHistoryVisits, visitsForVehicle, type LocalOilVisit } from "@/lib/vehicleHistory";

/**
 * The vehicle register on its own page (sidebar → Vehicles, under Oil
 * Changes). Local-first like the till's picker. A car's visits are one click
 * away: they open on Oil Changes, searched by its plate.
 */
export default function Vehicles() {
  usePageMeta({
    title: "Vehicles — UCU",
    description: "The cars the shop knows — plate, make and model — picked by name at the till.",
  });
  const { currentShop } = useShop();
  const navigate = useNavigate();
  const formatMoney = useFormatMoney();
  const { data: oilRows } = useLocalStore<LocalOilVisit>("oil_changes", currentShop?.id);
  const [historyFor, setHistoryFor] = useState<(HistoryVehicle & { id?: string }) | null>(null);
  const [visits, setVisits] = useState<HistoryVisit[] | null>(null);
  const openHistory = (v: HistoryVehicle & { id?: string }) => {
    setHistoryFor(v);
    setVisits(null);
  };
  // Built from the offline store, and rebuilt as visits sync in.
  useEffect(() => {
    if (!historyFor) return;
    let live = true;
    toHistoryVisits(visitsForVehicle(oilRows, historyFor)).then((h) => { if (live) setVisits(h); }).catch(() => live && setVisits([]));
    return () => { live = false; };
  }, [historyFor, oilRows]);

  // Global search lands here with `?vehicle=<id>`: open that car's history.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const id = params.get("vehicle");
    if (!id) return;
    setParams((p) => { p.delete("vehicle"); return p; }, { replace: true });
    getById<HistoryVehicle & { id: string }>("vehicles", id).then((v) => { if (v) openHistory(v); }).catch(() => {});
  }, [params, setParams]);

  if (currentShop && !isOil(currentShop)) {
    return (
      <Card className="p-12 text-center text-muted-foreground">
        Vehicles are for oil shops. Set the store type to{" "}
        <b>Oil Change / Lubricants</b> in Settings → Shop to use this page.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CarFront className="size-6 text-primary" /> Vehicles
          </h1>
          <p className="text-sm text-muted-foreground">
            Every car the shop knows. Click one to see its oil-change history — which oil went in last time, and every visit before.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/oil-changes"><Car className="size-4 me-1.5" /> Oil changes</Link>
        </Button>
      </div>
      <VehiclesRegister onHistory={openHistory} />
      <VehicleHistoryDialog
        vehicle={historyFor}
        visits={visits}
        onClose={() => setHistoryFor(null)}
        onOpenReceipt={(saleId) => navigate(`/sales?sale=${saleId}`)}
        formatMoney={(n) => formatMoney(n, currentShop?.currency ?? "PKR")}
      />
    </div>
  );
}
