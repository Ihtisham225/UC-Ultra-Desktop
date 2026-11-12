import { Link, useNavigate } from "react-router-dom";
import { Car, CarFront } from "lucide-react";
import { useShop } from "@/contexts/ShopContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePageMeta } from "@/hooks/usePageMeta";
import { isOil } from "@/lib/oil";
import VehiclesRegister from "@/components/VehiclesRegister";

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
            Every car the shop knows. Add one here or at the till; its oil changes are on the Oil Changes page.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/oil-changes"><Car className="size-4 me-1.5" /> Oil changes</Link>
        </Button>
      </div>
      <VehiclesRegister onSearchVisits={(plate) => navigate(`/oil-changes?q=${encodeURIComponent(plate)}`)} />
    </div>
  );
}
