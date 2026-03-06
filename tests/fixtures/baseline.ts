import { test as base, expect, type ConsoleMessage } from "@playwright/test";

type ErrorGuardFixtures = {
    guardNoConsoleError: void;
};

function formatConsoleError(msg: ConsoleMessage): string {
    const location = msg.location();
    const prefix = location.url
        ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
        : "unknown-location";
    return `console.error @ ${prefix}\n${msg.text()}`;
}

export const test = base.extend<ErrorGuardFixtures>({
    guardNoConsoleError: [
        async ({ page }, use) => {
            let failed = false;
            let rejectEarly: ((reason: unknown) => void) | null = null;

            const earlyFailure = new Promise<never>((_, reject) => {
                rejectEarly = reject;
            });

            const failFast = (error: Error): void => {
                if (failed) {
                    return;
                }
                failed = true;
                if (rejectEarly) {
                    rejectEarly(error);
                }
            };

            const onConsole = (msg: ConsoleMessage): void => {
                if (msg.type() === "error") {
                    failFast(new Error(formatConsoleError(msg)));
                }
            };

            const onPageError = (error: Error): void => {
                failFast(
                    new Error(
                        `pageerror: ${error.message}\n${error.stack || "(no stack)"}`
                    )
                );
            };

            page.on("console", onConsole);
            page.on("pageerror", onPageError);

            try {
                await Promise.race([use(), earlyFailure]);
            } finally {
                page.off("console", onConsole);
                page.off("pageerror", onPageError);
            }
        },
        { auto: true },
    ],
});

export { expect };

