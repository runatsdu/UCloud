import * as React from "react";
import { Link } from "react-router-dom";
import { Menu, Sidebar, Icon, Accordion, List, Responsive, AccordionTitleProps, SemanticICONS } from "semantic-ui-react";
import { Cloud } from "Authentication/SDUCloudObject";
import { connect } from "react-redux";
import { setSidebarState } from "./Redux/SidebarActions";
import { PP } from "UtilityComponents";
import { ReduxObject } from "DefaultObjects";
import { Dispatch } from "redux";

interface SidebarProps {
    open: boolean
    pp: boolean
    setSidebarState: (open: boolean) => void
}

interface SidebarState {
    activeIndices: [boolean, boolean, boolean]
}

class SidebarComponent extends React.Component<SidebarProps, SidebarState> {
    constructor(props) {
        super(props);
        this.state = {
            activeIndices: [false, false, false]
        };
    }

    handleClick = (_: React.MouseEvent<HTMLDivElement>, { index }: { index: number }) => {
        const { activeIndices } = this.state;
        activeIndices[index] = !activeIndices[index]
        this.setState({ activeIndices });
    }

    render() {
        const { open, setSidebarState } = this.props;
        const { activeIndices } = this.state;
        const sidebarIsOpen = open && window.innerWidth < 1000;

        const content = (
            <div className="container-wrapper">
                <div className="container-content">
                    <div className="container-padding responsive-container-margin">
                        {this.props.children}
                    </div>
                </div>
            </div>
        );

        return (
            <>
                <Responsive minWidth={1000}>
                    <Accordion as={Menu} vertical borderless fixed="left" className="my-sidebar">
                        <SidebarMenuItems handleClick={this.handleClick} activeIndices={activeIndices} closeSidebar={() => setSidebarState(false)} />
                    </Accordion>
                    {content}
                </Responsive>

                <Responsive maxWidth={999} as={Sidebar.Pushable} style={{ zIndex: -1 }}>
                    <MobileSidebar
                        closeSidebar={() => setSidebarState(false)}
                        visible={open}
                        handleClick={this.handleClick}
                        activeIndices={activeIndices}
                    />

                    <Sidebar.Pusher style={{ zIndex: -1 }}
                        onClick={() => setSidebarState(false)}
                        dimmed={sidebarIsOpen}
                    >
                        {content}
                    </Sidebar.Pusher>
                </Responsive>
            </ >
        );
    }
}

type HandleClick = (e: React.MouseEvent<HTMLDivElement>, d: AccordionTitleProps) => void;
interface AdminOptionsProps { menuActive: boolean, handleClick: HandleClick, closeSidebar: Function }
const AdminOptions = ({ menuActive, handleClick, closeSidebar }: AdminOptionsProps) => Cloud.userIsAdmin ? (
    <>
        <Accordion.Title onClick={handleClick} index={2} active={menuActive}>
            <Icon name="dropdown" style={{ marginLeft: "15px" }} />
            <span style={{ marginLeft: "15px" }}>Admin</span>
        </Accordion.Title>
        <Accordion.Content active={menuActive}>
            <List>
                <List.Item style={{ paddingLeft: "1em" }}>
                    <MenuLink icon="user plus" name="User Creation" onClick={() => closeSidebar()} to="/admin/usercreation" />
                </List.Item>
            </List>
        </Accordion.Content>
    </>) : null;

interface MobileSidebarProps { handleClick: HandleClick, activeIndices: boolean[], visible: boolean, closeSidebar: Function }
const MobileSidebar = ({ handleClick, activeIndices, visible, closeSidebar }: MobileSidebarProps) => (
    <Sidebar animation="overlay" visible={visible}>
        <Accordion as={Menu} borderless vertical fixed="left" className="my-sidebar">
            <SidebarMenuItems closeSidebar={closeSidebar} handleClick={handleClick} activeIndices={activeIndices} />
        </Accordion>
    </Sidebar>
);

const SidebarMenuItems = ({ handleClick, closeSidebar, activeIndices }) => (
    <>
        <Accordion>
            <Menu.Item>
                <MenuLink icon="home" to="/dashboard" name="Dashboard" onClick={closeSidebar} />
            </Menu.Item>
            <Menu.Item>
                <MenuLink icon="file outline" to={`/files/${Cloud.homeFolder}`} name="Files" onClick={closeSidebar} />
            </Menu.Item>
            <Menu.Item>
                <MenuLink icon="question" to={`/activity/`} name="Activity" onClick={closeSidebar} />
            </Menu.Item>
            <Menu.Item>
                <MenuLink icon="share square outline" to="/shares" name="Shares" onClick={closeSidebar} />
            </Menu.Item>
            <Accordion.Title onClick={handleClick} index={0} active={activeIndices[0]}>
                <Icon name="dropdown" style={{ marginLeft: "15px" }} />
                <span style={{ marginLeft: "15px" }}>Applications</span>
            </Accordion.Title>
            <Accordion.Content active={activeIndices[0]} >
                <List>
                    <List.Item style={{ paddingLeft: "1em" }}>
                        <MenuLink icon="code" name="Run" onClick={closeSidebar} to="/applications" />
                    </List.Item>
                    <List.Item style={{ paddingLeft: "1em" }}>
                        <MenuLink icon="tasks" name="Results" onClick={closeSidebar} to="/analyses" />
                    </List.Item>
                </List>
            </Accordion.Content>
            <Accordion.Title onClick={handleClick} index={1} active={activeIndices[1]}>
                <Icon name="dropdown" style={{ marginLeft: "15px" }} />
                <span style={{ marginLeft: "16px" }}>Publishing</span>
            </Accordion.Title>
            <Accordion.Content active={activeIndices[1]}>
                <List>
                    <List.Item style={{ paddingLeft: "1em" }}>
                        <MenuLink icon="newspaper outline" name="Publications" to="/zenodo" onClick={closeSidebar} />
                    </List.Item>
                    <List.Item style={{ paddingLeft: "1em" }}>
                        <MenuLink icon="edit" name="Publish" to="/zenodo/publish" onClick={closeSidebar} />
                    </List.Item>
                </List>
            </Accordion.Content>
            <AdminOptions menuActive={activeIndices[2]} handleClick={handleClick} closeSidebar={closeSidebar} />
        </Accordion>
    </>
);

const MenuLink = ({ icon, name, to, onClick }: { icon: SemanticICONS, name: string, to: string, onClick: () => void }) =>
    <Link to={to} onClick={onClick} className="sidebar-option">
        <List>
            <List.Item>
                <List.Content floated="left">
                    <List.Icon name={icon} />
                </List.Content>
                {name}
            </List.Item>
        </List>
    </Link>

const mapDispatchToProps = (dispatch: Dispatch) => ({
    setSidebarState: (open: boolean) => dispatch(setSidebarState(open))
});

const mapStateToProps = ({ sidebar }: ReduxObject) => sidebar;
export default connect(mapStateToProps, mapDispatchToProps)(SidebarComponent);