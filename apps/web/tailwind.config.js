// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fontFamily } = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/pages/**/*.{ts,tsx}",
        "./src/components/**/*.{ts,tsx}",
        "./src/app/**/*.{ts,tsx}",
    ],
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: { "2xl": "1400px" },
        },
        extend: {
            fontFamily: {
                main: ["Inter", ...fontFamily.sans],
                secondary: ["Inter", ...fontFamily.sans],
            },
            colors: {
                primary: {
                    DEFAULT: "#503ADC",
                    foreground: "#FFF",
                    900: "#120B69",
                    800: "#1C127F",
                    700: "#2B1D9E",
                    600: "#3C2ABD",
                    500: "#503ADC",
                    400: "#7C68EA",
                    300: "#9A88F4",
                    200: "#BEB1FB",
                    100: "#DFD7FD",
                    50: "#EFEBFE",
                },
                secondary: {
                    DEFAULT: "#A69BED",
                    foreground: "#FFF",
                },
                background: {
                    DEFAULT: "#F9F8F6",
                },
                destructive: {
                    DEFAULT: "#F72B27",
                    foreground: "#FFF",
                    100: "#FEE3D3",
                    200: "#FEC0A8",
                    300: "#FC957C",
                    400: "#FA6C5C",
                    500: "#F72B27",
                    600: "#D41C28",
                    700: "#B1132B",
                },
                success: {
                    DEFAULT: "#95DB0A",
                    foreground: "#FFF",
                    100: "#F3FDCC",
                    200: "#E5FB9B",
                    500: "#95DB0A",
                    600: "#79BC07",
                    700: "#609D05",
                },
                warning: {
                    DEFAULT: "#FC9105",
                    100: "#FEF1CC",
                    200: "#FEE09A",
                    500: "#FC9105",
                    600: "#D87303",
                    700: "#B55802",
                },
                neutral: {
                    DEFAULT: "#9E9E9E",
                    50: "#FAF9F7",
                    100: "#F5F3F0",
                    200: "#E8E6E3",
                    300: "#DAD8D5",
                    400: "#B5B3B0",
                    500: "#8F8D8A",
                    600: "#6B6966",
                    700: "#4A4845",
                    800: "#363432",
                    900: "#282624",
                },
            },
            boxShadow: {
                custom: "0 0 0 3px hsla(248, 70%, 55%, 25%), 0 0 0 1px hsla(248, 70%, 55%, 50%)",
                card: "0 0 0 1px rgba(0,0,0,0.03), 0 2px 4px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.04)",
            },
            spacing: {
                "sidebar-width": "224px",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    "0%": { opacity: "0", transform: "translateY(6px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.25s ease-out",
            },
        },
    },
    plugins: [
        require("tailwindcss-animate"),
        require("tailwind-scrollbar")({ nocompatible: true }),
        require("@tailwindcss/typography"),
    ],
};
