import * as React from "react";
import PromiseKeeper from "PromiseKeeper";
import { Cloud } from "Authentication/SDUCloudObject";
import {
    successNotification,
    defaultErrorHandler
} from "UtilityFunctions";
import { UserSettingsFields, UserSettingsState } from ".";
import { TwoFactorSetup } from "./TwoFactorSetup";
import * as Heading from "ui-components/Heading";
import { MainContainer } from "MainContainer/MainContainer";
import { Flex, Box, Tooltip, Icon, FormField, Input, Button, Label } from "ui-components";

class UserSettings extends React.Component<{}, UserSettingsState> {
    constructor(props) {
        super(props);
        this.state = this.initialState();
    }

    initialState(): UserSettingsState {
        return {
            promiseKeeper: new PromiseKeeper(),
            currentPassword: "",
            newPassword: "",
            repeatedPassword: "",
            error: false,
            repeatPasswordError: false
        };
    }

    updateField(field: UserSettingsFields, value: string | boolean): void {
        const state = { ...this.state }
        state[field] = value;
        state.error = false;
        state.repeatPasswordError = false;
        this.setState(() => state);
    }

    validateAndSubmit(e: React.SyntheticEvent): void {
        e.preventDefault();

        let error = false;
        let repeatPasswordError = false;

        const {
            currentPassword,
            newPassword,
            repeatedPassword,
        } = this.state;

        if (!currentPassword || !newPassword || !repeatedPassword) {
            error = true;
        }

        if (newPassword !== repeatedPassword) {
            error = true;
            repeatPasswordError = true;
        }

        this.setState(() => ({ error, repeatPasswordError }));

        if (!error) {
            this.state.promiseKeeper.makeCancelable(
                Cloud.post(
                    "/auth/users/password",
                    { currentPassword, newPassword },
                    ""
                )
            ).promise.then(f => {
                successNotification("Password successfully changed");
                this.setState(() => this.initialState());
            }).catch(error => {
                let status = defaultErrorHandler(error);
                this.setState(() => ({ error: true }));
            });
        }
    }

    render() {
        const {
            error,
            currentPassword,
            newPassword,
            repeatedPassword,
            repeatPasswordError
        } = this.state;

        return (
            <Flex alignItems="center" flexDirection="column">
                <Box width={0.7}>
                    <MainContainer
                        header={<Heading.h1>Change Password</Heading.h1>}
                        main={
                            <>
                                <form onSubmit={e => this.validateAndSubmit(e)}>
                                    <Box mt="0.5em" pt="0.5em">
                                        <Label>
                                            Current Password
                                            <Input
                                                value={currentPassword}
                                                type="password"
                                                placeholder={"Current password"}
                                                onChange={({ target: { value } }) => this.updateField("currentPassword", value)}
                                            />
                                            {error && !currentPassword ? <Icon name="warning" color="red" /> : null}
                                        </Label>
                                    </Box>
                                    <Box mt="0.5em" pt="0.5em">
                                        <Label>
                                            New Password
                                            <Input
                                                value={newPassword}
                                                type="password"
                                                onChange={({ target: { value } }) => this.updateField("newPassword", value)}
                                                placeholder="New password"
                                            />
                                            {error && !newPassword ? <Icon name="warning" color="red" /> : null}
                                        </Label>
                                    </Box>
                                    <Box mt="0.5em" pt="0.5em">
                                        <Label>
                                            Repeat new password
                                            <Input
                                                value={repeatedPassword}
                                                type="password"
                                                onChange={({ target: { value } }) => this.updateField("repeatedPassword", value)}
                                                placeholder="Repeat password"
                                            />
                                            {error && !repeatedPassword ? <Icon name="warning" color="red" /> : null}
                                        </Label>
                                    </Box>
                                    <Button
                                        mt="1em"
                                        type="submit"
                                        color="green"
                                        hoverColor="darkGreen"
                                    >
                                        Change password
                                    </Button>
                                </form>
                                <TwoFactorSetup />
                            </>
                        }
                    />
                </Box>
            </Flex>
        );
    }
}

export default UserSettings;