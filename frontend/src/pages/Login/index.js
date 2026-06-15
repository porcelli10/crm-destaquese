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
	"@keyframes floatA": {
		"0%":   { transform: "translate(0px, 0px) scale(1)" },
		"50%":  { transform: "translate(40px, -50px) scale(1.08)" },
		"100%": { transform: "translate(0px, 0px) scale(1)" },
	},
	"@keyframes floatB": {
		"0%":   { transform: "translate(0px, 0px) scale(1)" },
		"50%":  { transform: "translate(-45px, 35px) scale(1.12)" },
		"100%": { transform: "translate(0px, 0px) scale(1)" },
	},
	"@keyframes floatC": {
		"0%":   { transform: "translate(0px, 0px) scale(1)" },
		"50%":  { transform: "translate(30px, 40px) scale(0.92)" },
		"100%": { transform: "translate(0px, 0px) scale(1)" },
	},
	"@keyframes cardIn": {
		"0%":   { opacity: 0, transform: "translateY(24px)" },
		"100%": { opacity: 1, transform: "translateY(0)" },
	},
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
		overflow: "hidden",
	},
	// Fundo animado — orbs roxos suaves (efeito aurora)
	blob: {
		position: "absolute",
		borderRadius: "50%",
		filter: "blur(60px)",
		opacity: 0.55,
		pointerEvents: "none",
		zIndex: 0,
	},
	blobA: {
		width: 420,
		height: 420,
		top: "-120px",
		left: "-100px",
		background: "radial-gradient(circle at 30% 30%, #8B5CF6 0%, #682EE3 70%)",
		animation: "$floatA 16s ease-in-out infinite",
	},
	blobB: {
		width: 360,
		height: 360,
		bottom: "-110px",
		right: "-80px",
		background: "radial-gradient(circle at 30% 30%, #A78BFA 0%, #682EE3 75%)",
		animation: "$floatB 20s ease-in-out infinite",
	},
	blobC: {
		width: 300,
		height: 300,
		top: "55%",
		left: "8%",
		background: "radial-gradient(circle at 30% 30%, #C4B5FD 0%, #7C3AED 80%)",
		opacity: 0.35,
		animation: "$floatC 24s ease-in-out infinite",
	},
	container: {
		position: "relative",
		zIndex: 1,
	},
	paper: {
		backgroundColor: "#FFFFFF",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		padding: "48px 40px 40px",
		borderRadius: "16px",
		borderTop: "4px solid #682EE3",
		boxShadow: "0 18px 50px rgba(104,46,227,0.18), 0 4px 16px rgba(0,0,0,0.06)",
		animation: "$cardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
	},
	avatar: {
		margin: theme.spacing(1),
		backgroundColor: theme.palette.secondary.main,
	},
	form: {
		width: "100%",
		marginTop: theme.spacing(2),
		// Campos de email/senha mais bonitos
		"& .MuiOutlinedInput-root": {
			borderRadius: 12,
			backgroundColor: "#FAF9F6",
			transition: "box-shadow 0.2s ease, background-color 0.2s ease",
			"& fieldset": {
				borderColor: "#E5E2DA",
				transition: "border-color 0.2s ease",
			},
			"&:hover fieldset": {
				borderColor: "#C9BEF2",
			},
			"&.Mui-focused": {
				backgroundColor: "#FFFFFF",
				boxShadow: "0 0 0 4px rgba(104,46,227,0.12)",
			},
			"&.Mui-focused fieldset": {
				borderColor: "#682EE3",
				borderWidth: 2,
			},
		},
		"& .MuiInputLabel-root.Mui-focused": {
			color: "#682EE3",
		},
	},
	submit: {
		margin: theme.spacing(3, 0, 2),
		borderRadius: 12,
		fontWeight: 600,
		letterSpacing: "0.5px",
		padding: "12px 0",
		textTransform: "none",
		fontSize: "1rem",
		background: "linear-gradient(135deg, #7C3AED 0%, #682EE3 100%)",
		boxShadow: "0 8px 20px rgba(104,46,227,0.30)",
		transition: "transform 0.15s ease, box-shadow 0.2s ease",
		"&:hover": {
			background: "linear-gradient(135deg, #6D28D9 0%, #5B21B6 100%)",
			boxShadow: "0 12px 26px rgba(104,46,227,0.40)",
			transform: "translateY(-2px)",
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
		zIndex: 2,
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
		{/* Fundo animado */}
		<div className={`${classes.blob} ${classes.blobA}`} />
		<div className={`${classes.blob} ${classes.blobB}`} />
		<div className={`${classes.blob} ${classes.blobC}`} />

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
		<Container className={classes.container} component="main" maxWidth="xs">
			<CssBaseline/>
			<div className={classes.paper}>
				<div>
					<img style={{ margin: "0 auto", width: "70%" }} src={logo} alt="Whats" />
				</div>
				{/*<Typography component="h1" variant="h5">
					{i18n.t("login.title")}
				</Typography>*/}
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

					{/* <Grid container justify="flex-end">
					  <Grid item xs={6} style={{ textAlign: "right" }}>
						<Link component={RouterLink} to="/forgetpsw" variant="body2">
						  Esqueceu sua senha?
						</Link>
					  </Grid>
					</Grid>*/}

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
