"use client";

import { useEffect, useMemo, useState } from "react";

import { callLabel } from "~/lib/booking/page";
import { cn } from "~/lib/utils";

import { lengthChoices } from "../page/links";
import type { PageRead, Transport } from "../react/data";
import type { BookingPage, ListedLink } from "../types";
import { Duration } from "./Duration";
import { MeetBooking } from "./MeetBooking";
import { MeetDust } from "./MeetDust";
import { HomeAction, MeetMessage } from "./MeetMessage";
import { MeetThemeColor } from "./MeetThemeColor";
import { MeetTitle } from "./MeetTitle";
import { PortraitRing } from "./PortraitRing";
import { PressButton } from "./PressButton";
import { MeetDataContext } from "./data";
import { MeetHostContext, useMeetHost } from "./host";
import { takeIntro } from "./intro";
import styles from "./meet.module.css";
import { STICKY_HEADER } from "./sticky";

/**
 * One Booking link's page, as /meet draws it. /meet reads the link on the
 * server and draws it whole; this reads it in the browser through the
 * transport, showing the page's empty ground until it's in, and then plays
 * the same entrance. A closed or unknown link says so in the page's own
 * look, as /meet's closed page does.
 */
export function MeetScreen({
  slug,
  transport,
  siblings,
  initial,
  turnstileSiteKey,
  heading = true,
}: {
  slug: string;
  transport: Transport;
  /** The link's same-titled siblings, whose lengths the page offers too (links.ts). */
  siblings: ListedLink[];
  initial?: BookingPage;
  turnstileSiteKey?: string;
  /** The title and the line under it; on unless false. */
  heading?: boolean;
}) {
  const [read, setRead] = useState<PageRead | null>(initial ? { status: "open", page: initial } : null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (initial && attempt === 0) return;
    let cancelled = false;
    // A second read follows a failure, so it skips the CDN's copy.
    void transport.page(slug, undefined, { fresh: attempt > 0 }).then((answer) => {
      if (!cancelled) setRead(answer);
    });
    return () => {
      cancelled = true;
    };
  }, [transport, slug, initial, attempt]);

  const host = useMeetHost();
  const opened = read?.status === "open" ? read.page : null;
  const choices = useMemo(() => (opened ? lengthChoices(opened.link, siblings) : []), [opened, siblings]);
  const slugFor = useMemo(() => {
    const bySize = new Map(choices.map((choice) => [choice.length, choice.slug]));
    return (length: number) => bySize.get(length) ?? slug;
  }, [choices, slug]);
  // The initials stand for the link's host when there's no photo.
  const named = useMemo(() => ({ ...host, name: host.name ?? opened?.link.host }), [host, opened]);

  if (read === null) return <div className="meet-root" data-entering="wait" aria-busy="true" />;
  if (read.status === "unavailable")
    return (
      <MeetMessage
        title="Book a time"
        heading="The calendar didn't answer."
        actions={
          <>
            <PressButton type="button" onClick={() => setAttempt((n) => n + 1)}>
              <span className="relative">Try again</span>
            </PressButton>
            <HomeAction />
          </>
        }
      >
        It&apos;s usually brief, so try again in a minute.
      </MeetMessage>
    );
  if (read.status === "closed")
    return (
      <MeetMessage title="Book a time" heading="Booking isn't open right now." actions={<HomeAction />}>
        {read.message === "Booking isn't open right now." || read.message === "This booking link isn't open."
          ? "No times are open to book. Check back soon."
          : read.message}
      </MeetMessage>
    );

  const page: BookingPage = {
    ...read.page,
    link: { ...read.page.link, lengths: choices.length ? choices.map((c) => c.length) : read.page.link.lengths },
  };
  return (
    <MeetHostContext.Provider value={named}>
      <MeetDataContext.Provider value={{ transport, slugFor }}>
        <MeetOpen slug={slug} page={page} turnstileSiteKey={turnstileSiteKey} heading={heading} key={attempt} />
      </MeetDataContext.Provider>
    </MeetHostContext.Provider>
  );
}

function MeetOpen({
  slug,
  page,
  turnstileSiteKey,
  heading,
}: {
  slug: string;
  page: BookingPage;
  turnstileSiteKey: string | undefined;
  heading: boolean;
}) {
  // /meet's script picks this before the first paint (intro.ts); here
  // it's picked as the page first draws, before MeetTitle starts it.
  const [intro] = useState(takeIntro);
  const title = page.link.title;
  const length = page.link.lengths.length === 1 ? page.link.lengths[0]! : null;

  return (
    <div className="meet-root" data-entering="wait" {...(intro ? { "data-intro": "" } : {})}>
      <MeetThemeColor />
      <MeetDust />
      <PortraitRing />
      {STICKY_HEADER && <div aria-hidden className={styles.statusFade} />}
      <main className={styles.main}>
        {/* On a phone, centred over the Days, as the grid's nav is: the
          rail's 2.5rem in, less the 0.75rem the grid reaches into the
          gutter. Beside the card, in line with the first Day's heading:
          the rail's 3.25rem and the heading's 0.5rem inset in, with the
          photo over the rail. */}
        <header
          hidden={!heading}
          className={cn(
            styles.titleHead,
            "relative mb-2 max-[871.98px]:pl-[1.75rem] max-[871.98px]:text-center min-[872px]:mb-5 min-[872px]:pl-[3.75rem]",
          )}
        >
          <MeetTitle title={title} />
          {/* A phone's booking card says the same, so it's left out there. */}
          <p
            data-enter
            style={{ ["--enter" as string]: 1 }}
            className={cn(styles.facts, "max-[871.98px]:hidden")}
          >
            {length !== null && (
              <>
                <Duration minutes={length} />
                <span aria-hidden> · </span>
              </>
            )}
            {callLabel(page.link.call)}
          </p>
        </header>

        <section aria-label="Pick a time">
          <MeetBooking slug={slug} initial={page} turnstileSiteKey={turnstileSiteKey} />
        </section>
      </main>
    </div>
  );
}
