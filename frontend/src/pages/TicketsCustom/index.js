import React from "react";
import { useParams } from "react-router-dom";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import { makeStyles } from "@material-ui/core/styles";

import Typography from "@material-ui/core/Typography";
import ForumOutlinedIcon from "@material-ui/icons/ForumOutlined";

import TicketsManager from "../../components/TicketsManagerTabs/";
import Ticket from "../../components/Ticket/";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	chatContainer: {
		flex: 1,
		// backgroundColor: "#eee",
		padding: theme.spacing(1), //Aqui ele ajusta espaço na tela de ticket
		height: `calc(100% - 48px)`,
		overflowY: "hidden",
	},

	chatPapper: {
		// backgroundColor: "red",
		display: "flex",
		height: "100%",
	},

	contactsWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
		overflowY: "hidden",
	},
	messagesWrapper: {
		display: "flex",
		height: "100%",
		flexDirection: "column",
	},
	welcomeMsg: {
		backgroundColor: theme.palette.type === "light" ? "#FAF9F6" : theme.palette.boxticket,
		display: "flex",
		flexDirection: "column",
		justifyContent: "center",
		alignItems: "center",
		height: "100%",
		textAlign: "center",
		gap: 16,
	},
	emptyIcon: {
		width: 96,
		height: 96,
		borderRadius: "50%",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: "rgba(104,46,227,0.08)",
		color: "#682EE3",
	},
	emptyTitle: {
		fontWeight: 600,
		color: theme.palette.type === "light" ? "#3A3A42" : "#F3F3F3",
	},
	emptySubtitle: {
		fontSize: 14,
		color: theme.palette.type === "light" ? "#8A8A93" : "#BBB",
		maxWidth: 280,
	},
}));

const TicketsCustom = () => {
	const classes = useStyles();
	const { ticketId } = useParams();

	return (
		<div className={classes.chatContainer}>
			<div className={classes.chatPapper}>
				<Grid container spacing={0}>
					<Grid item xs={4} className={classes.contactsWrapper}>
						<TicketsManager />
					</Grid>
					<Grid item xs={8} className={classes.messagesWrapper}>
						{ticketId ? (
							<>
								<Ticket />
							</>
						) : (
							<Paper square variant="outlined" className={classes.welcomeMsg}>
								<div className={classes.emptyIcon}>
									<ForumOutlinedIcon style={{ fontSize: 44 }} />
								</div>
								<Typography variant="h6" className={classes.emptyTitle}>
									{i18n.t("chat.noTicketMessage")}
								</Typography>
								<Typography className={classes.emptySubtitle}>
									Selecione uma conversa na lista ao lado para começar o atendimento.
								</Typography>
							</Paper>
						)}
					</Grid>
				</Grid>
			</div>
		</div>
	);
};

export default TicketsCustom;
