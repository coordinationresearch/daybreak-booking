// `/<slug>`: one link's page. Its first week is read on the server, so the times draw without
// waiting, and Next keeps the page for 60 seconds, as the proxy's reads are kept.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { BookingError, type BookingPage } from "@coordination/booking";
import { Booking } from "../Booking";
import { daybreak } from "../../lib/daybreak";

export const revalidate = 60;

const SLUG = /^[a-z0-9-]{1,64}$/;

// One read per render, shared by the title and the page. Null when there's no such link.
const firstWeek = cache(async (slug: string): Promise<BookingPage | null | undefined> => {
  if (!SLUG.test(slug)) return null;
  try {
    return await daybreak().page(slug);
  } catch (error) {
    if (error instanceof BookingError && error.code === "not_found") return null;
    // Anything else (missing variables, a paused page, the deployment not answering): the page
    // reads again in the browser and says what the proxy answers.
    return undefined;
  }
});

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await firstWeek((await params).slug);
  if (!page) return {};
  return { title: page.link.title, description: `Book time with ${page.link.host}.` };
}

export default async function LinkPage({ params }: Props) {
  const { slug } = await params;
  const page = await firstWeek(slug);
  if (page === null) notFound();
  return (
    <main>
      <Booking slug={slug} initial={page} />
    </main>
  );
}
