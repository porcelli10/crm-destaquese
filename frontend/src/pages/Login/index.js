import React, { useState, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import Button from "@material-ui/core/Button";
import CssBaseline from "@material-ui/core/CssBaseline";
import TextField from "@material-ui/core/TextField";
import Link from "@material-ui/core/Link";
import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import { versionSystem } from "../../../package.json";
import { i18n } from "../../translate/i18n";
import { nomeEmpresa } from "../../../package.json";
import { AuthContext } from "../../context/Auth/AuthContext";
import logo from "../../assets/logo.png";
import {LanguageOutlined} from "@material-ui/icons";
import {IconButton, Menu, MenuItem} from "@material-ui/core";
import LanguageControl from "../../components/LanguageControl";


const Copyright = () => {
	return (
		<Typography variant="body2" color="primary" align="center">
			{"Copyright "}
 			<Link color="primary" href="#">
 				{ nomeEmpresa } - v { versionSystem }
 			</Link>{" "}
 			{new Date().getFullYear()}
 			{"."}
 		</Typography>
 	);
 };

const useStyles = makeStyles(theme => ({
	root: {
		width: "100vw",
		height: "100vh",
		backgroundColor: "#F5F3EF",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		textAlign: "center",
		position: "relative",
	},
	paper: {
		backgroundColor: "#FFFFFF",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		padding: "44px 40px 36px",
		borderRadius: "12px",
		border: "1px solid #E5E2DA",
		borderTop: "4px solid #682EE3",
		boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
	},
	// Painel da logo (a logo da empresa e branca) — cor de acento chapada
	logoWrapper: {
		width: "100%",
		backgroundColor: "#682EE3",
		borderRadius: 10,
		padding: "20px 24px",
		marginBottom: 10,
		display: "flex",
		justifyContent: "center",
		alignItems: "center",
	},
	logoImg: {
		width: "70%",
		display: "block",
	},
	form: {
		width: "100%",
		marginTop: theme.spacing(1),
		"& .MuiOutlinedInput-root": {
			borderRadius: 10,
			backgroundColor: "#FFFFFF",
			"& fieldset": {
				borderColor: "#D8D4CC",
			},
			"&:hover fieldset": {
				borderColor: "#B9B3A6",
			},
			"&.Mui-focused fieldset": {
				borderColor: "#682EE3",
			},
		},
		"& .MuiOutlinedInput-input": {
			color: "#2A2A33",
		},
		"& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus": {
			WebkitBoxShadow: "0 0 0 1000px #FFFFFF inset",
			WebkitTextFillColor: "#2A2A33",
			caretColor: "#2A2A33",
			borderRadius: 10,
			transition: "background-color 9999s ease-in-out 0s",
		},
		"& .MuiInputLabel-root": {
			color: "#6B6B72",
		},
		"& .MuiInputLabel-root.Mui-focused": {
			color: "#682EE3",
		},
	},
	submit: {
		margin: theme.spacing(3, 0, 2),
		borderRadius: 10,
		fontWeight: 600,
		padding: "11px 0",
		fontSize: "0.95rem",
		backgroundColor: "#682EE3",
		color: "#FFFFFF",
		boxShadow: "none",
		"&:hover": {
			backgroundColor: "#5A27C7",
			boxShadow: "none",
		},
	},
	powered: {
		color: "#888"
	},
	languageControl: {
		position: "absolute",
		top: 0,
		left: 0,
		paddingLeft: 15,
	}
}));

const Login = () => {
	const classes = useStyles();

	const [user, setUser] = useState({ email: "", password: "" });

	// Languages
	const [anchorElLanguage, setAnchorElLanguage] = useState(null);
	const [menuLanguageOpen, setMenuLanguageOpen] = useState(false);

	const { handleLogin } = useContext(AuthContext);

	const handleChangeInput = e => {
		setUser({ ...user, [e.target.name]: e.target.value });
	};

	const handlSubmit = e => {
		e.preventDefault();
		handleLogin(user);
	};

	const handlemenuLanguage = ( event ) => {
		setAnchorElLanguage(event.currentTarget);
		setMenuLanguageOpen( true );
	}

	const handleCloseMenuLanguage = (  ) => {
		setAnchorElLanguage(null);
		setMenuLanguageOpen(false);
	}

	return (
		<div className={classes.root}>
		<div className={classes.languageControl}>
			<IconButton edge="start">
				<LanguageOutlined
					aria-label="account of current user"
					aria-controls="menu-appbar"
					aria-haspopup="true"
					onClick={handlemenuLanguage}
					variant="contained"
					style={{ color: "#555", marginRight:10 }}
				/>
			</IconButton>
			<Menu
				id="menu-appbar-language"
				anchorEl={anchorElLanguage}
				getContentAnchorEl={null}
				anchorOrigin={{
					vertical: "bottom",
					horizontal: "right",
				}}
				transformOrigin={{
					vertical: "top",
					horizontal: "right",
				}}
				open={menuLanguageOpen}
				onClose={handleCloseMenuLanguage}
			>
				<MenuItem>
					<LanguageControl />
				</MenuItem>
			</Menu>
		</div>
		<Container component="main" maxWidth="xs">
			<CssBaseline/>
			<div className={classes.paper}>
				<div className={classes.logoWrapper}>
					<img className={classes.logoImg} src={logo} alt="Logo" />
				</div>
				<form className={classes.form} noValidate onSubmit={handlSubmit}>
					<TextField
						variant="outlined"
						margin="normal"
						required
						fullWidth
						id="email"
						label={i18n.t("login.form.email")}
						name="email"
						value={user.email}
						onChange={handleChangeInput}
						autoComplete="email"
						autoFocus
					/>
					<TextField
						variant="outlined"
						margin="normal"
						required
						fullWidth
						name="password"
						label={i18n.t("login.form.password")}
						type="password"
						id="password"
						value={user.password}
						onChange={handleChangeInput}
						autoComplete="current-password"
					/>
					<Button
						type="submit"
						fullWidth
						variant="contained"
						color="primary"
						className={classes.submit}
					>
						{i18n.t("login.buttons.submit")}
					</Button>
					{ <Grid container>
						<Grid item>
							<Link
								href="#"
								variant="body2"
								component={RouterLink}
								to="/signup"
							>
								{i18n.t("login.buttons.register")}
							</Link>
						</Grid>
					</Grid> }
				</form>
			</div>
			<Box mt={8}><Copyright /></Box>
		</Container>
		</div>
	);
};

export default Login;
