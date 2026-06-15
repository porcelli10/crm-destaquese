import React, { useState, useEffect } from "react";

import "react-toastify/dist/ReactToastify.css";
import { QueryClient, QueryClientProvider } from "react-query";

import {enUS, ptBR, esES} from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import { useMediaQuery } from "@material-ui/core";
import ColorModeContext from "./layout/themeContext";
import { SocketContext, SocketManager } from './context/Socket/SocketContext';

import Routes from "./routes";

const queryClient = new QueryClient();

const App = () => {
    const [locale, setLocale] = useState();

    const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
    const preferredTheme = window.localStorage.getItem("preferredTheme");
    const [mode, setMode] = useState(preferredTheme ? preferredTheme : prefersDarkMode ? "dark" : "light");

    const colorMode = React.useMemo(
        () => ({
            toggleColorMode: () => {
                setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
            },
        }),
        []
    );

    const theme = createTheme(
        {
            shape: {
                borderRadius: 10,
            },
            typography: {
                fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
                button: {
                    textTransform: "none",
                    fontWeight: 600,
                },
                h6: { fontWeight: 600 },
            },
            props: {
                MuiButton: { disableElevation: true },
                MuiAppBar: { elevation: 0 },
            },
            overrides: {
                MuiButton: {
                    root: {
                        borderRadius: 10,
                        padding: "7px 18px",
                    },
                    contained: {
                        boxShadow: "none",
                        "&:hover": {
                            boxShadow: "none",
                        },
                    },
                },
                MuiPaper: {
                    rounded: {
                        borderRadius: 14,
                    },
                    outlined: {
                        border: mode === "light" ? "1px solid #E5E2DA" : "1px solid #333",
                    },
                },
                MuiCard: {
                    root: {
                        borderRadius: 14,
                        border: mode === "light" ? "1px solid #E5E2DA" : "1px solid #333",
                        boxShadow: mode === "light"
                            ? "0 2px 10px rgba(0,0,0,0.05)"
                            : "none",
                    },
                },
                MuiOutlinedInput: {
                    root: {
                        borderRadius: 10,
                    },
                },
                MuiDialog: {
                    paper: {
                        borderRadius: 16,
                    },
                },
                MuiTableHead: {
                    root: {
                        "& .MuiTableCell-head": {
                            fontWeight: 700,
                            color: mode === "light" ? "#3A3A42" : "#F3F3F3",
                            backgroundColor: mode === "light" ? "#F5F3EF" : "#2A2A3A",
                        },
                    },
                },
                MuiChip: {
                    root: {
                        borderRadius: 8,
                        fontWeight: 500,
                    },
                },
                MuiTab: {
                    root: {
                        textTransform: "none",
                        fontWeight: 600,
                    },
                },
                MuiListItem: {
                    root: {
                        "&.Mui-selected": {
                            backgroundColor: "rgba(104,46,227,0.08)",
                        },
                        "&.Mui-selected:hover": {
                            backgroundColor: "rgba(104,46,227,0.12)",
                        },
                    },
                },
                MuiTableCell: {
                    root: {
                        borderBottom: mode === "light"
                            ? "1px solid #ECE9E2"
                            : "1px solid #2E2E3E",
                    },
                },
                MuiDialogTitle: {
                    root: {
                        "& .MuiTypography-root": {
                            fontWeight: 600,
                        },
                    },
                },
                MuiDivider: {
                    root: {
                        backgroundColor: mode === "light" ? "#ECE9E2" : "#2E2E3E",
                    },
                },
            },
            scrollbarStyles: {
                "&::-webkit-scrollbar": {
                    width: '6px',
                    height: '6px',
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: mode === "light" ? "#C4BDDB" : "#444",
                    borderRadius: "3px",
                },
                "&::-webkit-scrollbar-track": {
                    backgroundColor: "transparent",
                },
            },
            scrollbarStylesSoft: {
                "&::-webkit-scrollbar": {
                    width: "6px",
                },
                "&::-webkit-scrollbar-thumb": {
                    backgroundColor: mode === "light" ? "#DDD9D0" : "#333333",
                    borderRadius: "3px",
                },
            },
            palette: {
                type: mode,
                primary: { main: mode === "light" ? "#682EE3" : "#FFFFFF" },
                textPrimary: mode === "light" ? "#682EE3" : "#FFFFFF",
                borderPrimary: mode === "light" ? "#682EE3" : "#FFFFFF",
                dark: { main: mode === "light" ? "#1A1A1A" : "#F3F3F3" },
                light: { main: mode === "light" ? "#F3F3F3" : "#333333" },
                tabHeaderBackground: mode === "light" ? "#E8E5DF" : "#666",
                optionsBackground: mode === "light" ? "#F5F3EF" : "#333",
				options: mode === "light" ? "#F5F3EF" : "#666",
				fontecor: mode === "light" ? "#128c7e" : "#fff",
                fancyBackground: mode === "light" ? "#F5F3EF" : "#1C1C2E",
				bordabox: mode === "light" ? "#E5E2DA" : "#333",
				newmessagebox: mode === "light" ? "#EAE8E3" : "#333",
				inputdigita: mode === "light" ? "#fff" : "#666",
				contactdrawer: mode === "light" ? "#fff" : "#666",
				announcements: mode === "light" ? "#EAE8E3" : "#333",
				login: mode === "light" ? "#fff" : "#1C1C1C",
				announcementspopover: mode === "light" ? "#fff" : "#666",
				chatlist: mode === "light" ? "#EAE8E3" : "#666",
				boxlist: mode === "light" ? "#E5E2DC" : "#666",
				boxchatlist: mode === "light" ? "#E5E2DC" : "#333",
                total: mode === "light" ? "#fff" : "#222",
                messageIcons: mode === "light" ? "#6B6B6B" : "#F3F3F3",
                inputBackground: mode === "light" ? "#FFFFFF" : "#333",
                barraSuperior: mode === "light" ? "#682EE3" : "#1C1C2E",
				boxticket: mode === "light" ? "#E8E5DF" : "#666",
				campaigntab: mode === "light" ? "#E5E2DC" : "#666",
				mediainput: mode === "light" ? "#EAE8E3" : "#1c1c1c",
            },
            mode,
        },
        locale
    );

    useEffect(() => {
        const i18nlocale = localStorage.getItem("i18nextLng");
        const browserLocale = i18nlocale?.substring(0, 2) ?? 'pt';

        if (browserLocale === "pt"){
            setLocale(ptBR);
        }else if( browserLocale === "en" ) {
            setLocale(enUS)
        }else if( browserLocale === "es" )
            setLocale(esES)

    }, []);

    useEffect(() => {
        window.localStorage.setItem("preferredTheme", mode);
    }, [mode]);



    return (
        <ColorModeContext.Provider value={{ colorMode }}>
            <ThemeProvider theme={theme}>
                <QueryClientProvider client={queryClient}>
                  <SocketContext.Provider value={SocketManager}>
                      <Routes />
                  </SocketContext.Provider>
                </QueryClientProvider>
            </ThemeProvider>
        </ColorModeContext.Provider>
    );
};

export default App;
