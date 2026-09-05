import { useShop } from "@/contexts/ShopContext";
import { isHandicraft } from "@/lib/handicraft";
import Customers from "./Customers";
import CraftCustomers from "./CraftCustomers";

/**
 * A craft shop sells on a challan, not through the till, so its Customers page
 * is a different book entirely — billed, received, outstanding — rather than
 * the profile-and-purchase-history one every other store type gets.
 */
export default function CustomersRouter() {
  const { currentShop } = useShop();
  return isHandicraft(currentShop) ? <CraftCustomers /> : <Customers />;
}
