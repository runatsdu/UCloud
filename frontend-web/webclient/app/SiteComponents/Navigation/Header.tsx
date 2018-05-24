import * as React from "react";
import { Button, Input, Menu, Dropdown, Icon, Responsive, Header as H1 } from "semantic-ui-react";
import { Cloud } from "../../../authentication/SDUCloudObject"
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import "./Header.scss";
import Notifications from "../Notifications/index";
import { setSidebarOpen } from "../../Actions/Sidebar";

interface HeaderProps { title: string }
class Header extends React.Component<any, any> {
    constructor(props) {
        super(props);
    }

    public render() {
        const sidebarIcon = this.props.open ? "triangle left" : "triangle right";
        return (
            <Menu className="menu-padding">
                <Responsive maxWidth={1024}>
                    <Menu.Item onClick={() => this.props.dispatch(setSidebarOpen())} className="sidebar-button-padding">
                        <Icon.Group size="large">
                            <Icon name="sidebar" />
                            <Icon corner color="grey" size="massive" name={sidebarIcon} />
                        </Icon.Group>
                    </Menu.Item>
                </Responsive>
                <Menu.Item>
                    <H1>SDUCloud</H1>
                </Menu.Item>
                <Menu.Menu position="right">
                    <Menu.Item>
                        <Responsive minWidth={700}>
                            <Input className="header-search" fluid icon='search' placeholder='Search...' />
                        </Responsive>
                        <Responsive maxWidth={699}>
                            <Link to={`/metadata/search?query=updateplz`}>
                                <Icon name='search' />
                            </Link>
                        </Responsive>
                    </Menu.Item>
                    <Menu.Item>
                        <Notifications />
                    </Menu.Item>
                    <Dropdown item icon="settings">
                        <Dropdown.Menu>
                            <Dropdown.Item onClick={() => Cloud.logout()}>Logout</Dropdown.Item>
                        </Dropdown.Menu>
                    </Dropdown>
                </Menu.Menu>
            </Menu>
        );
    }
}

const mapStateToProps = ({ sidebar }: any) => ({ open: sidebar.open });
export default connect(mapStateToProps)(Header);
