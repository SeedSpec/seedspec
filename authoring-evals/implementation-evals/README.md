# Downstream implementation eval

This eval tests whether an authored package leads a fresh implementation agent
to produce operationally correct behavior. It does not grade the package prose.

The agent receives one blinded package, the same adapter contract, and visible
smoke tests. Controller-held tests exercise setup, delivery, retries, no-data
behavior, link authorization, failure visibility, and conflict handling.

Use one fresh model session per package. Treat a single run per package as a
screen, not a stable model estimate. Repeat boundary cases before making a
product decision.

