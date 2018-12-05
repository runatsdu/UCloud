import * as React from "react";
import { Flex, Box } from "ui-components";
import { SpaceProps, WidthProps, AlignItemsProps, JustifyContentProps, FlexWrapProps, FlexDirectionProps } from "styled-system";

interface SpacerProps extends SpaceProps, WidthProps, AlignItemsProps, JustifyContentProps, FlexWrapProps, FlexDirectionProps {
    left: React.ReactChild
    right: React.ReactChild
}

export const Spacer = ({ left, right, ...props }: SpacerProps) => (
    <Flex {...props}>
        {left}
        <Box ml="auto" />
        {right}
    </Flex>
)