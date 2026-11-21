// `/`: your listed Booking links, each opening at /<slug>. The page reads them through the proxy.
import { Booking } from "./Booking";

export default function Home() {
  return (
    <main>
      <Booking />
    </main>
  );
}
