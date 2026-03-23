# I've been running CanIShip on indie products. Some of you are not okay.

A few months ago I posted here about building CanIShip. Operations guy, no dev background, built a QA audit tool because I needed a quality gate before shipping. The post did well, people were kind, and I went back to building.

Since then I've been doing the thing I probably should have warned you I was going to do. I've been running audits on products people post here. A lot of them.

And I need to say something.

Some of you are shipping things that should not be shipping. I'm not talking about "your onboarding flow is a bit clunky." I mean missing security headers, exposed data surface, no HTTPS enforcement, Content-Security-Policy not configured, X-Frame-Options missing, the kind of stuff that makes an ISMS auditor physically uncomfortable. I spent 7 years doing information security consulting. I've sat across the table from companies that got burned because nobody thought about the basics. The basics are not optional.

I want to be clear: I'm not here to shame anyone. I know how this goes. You're building alone, you're moving fast, you're trying to get to market before you run out of motivation (and money), and security headers are not the thing that keeps you up at night. I get it. But they should at least be on your list.

Here's roughly what I've seen across the audits I've run: products above 90 are almost all built by engineers with teams. Products below 60 are almost all solo builders. The gap is not intelligence or effort. It's just that engineers have the muscle memory for this stuff and the rest of us don't.

The most common failure is not what I expected. I thought it would be performance (slow pages, bad Core Web Vitals). It's not. It's security surface. Missing headers, no HTTPS redirect enforcement, forms that expose more than they should. Second most common is accessibility, which at this point has legal exposure in several markets, not just a UX nice-to-have.

CanIShip has come a long way since I posted. The tool audited itself at 75/100 when I first launched. It's at 96 now (I fixed what it found on itself, which felt right). The reports are more detailed, the scoring is more calibrated, and the Docker self-hosted option is live for people who can't send their app URLs to a third party service. That last one I built because some of you asked about it and because in my consulting world, nobody sends a URL to a stranger and says "please audit this."

If you've shipped something and haven't run a real QA pass on it, go do it. Use CanIShip, use something else, use a checklist, use whatever. Just run the check. A product that's live and collecting real users deserves at least the same quality gate you'd apply to anything physical before it leaves the warehouse.

I built this for solo builders like me because nobody else was going to. It's at caniship.actvli.com. The free audit covers enough to tell you whether you have a problem.

And if you're one of the products I audited that scored well, genuinely, good work. You care about the craft and it shows.
