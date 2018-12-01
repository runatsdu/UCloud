import styled from "styled-components";
import { space, ButtonStyleProps, SpaceProps, SizeProps } from "styled-system";
import theme, { Theme, ThemeColor } from "./theme";

const size = ({ size, theme }: { size: string, theme: Theme }) => {
  switch (size) {
    case "tiny":
      return {
        fontSize: `${theme.fontSizes[0]}px`,
        padding: "6.5px 12px"
      }
    case "small":
      return {
        fontSize: `${theme.fontSizes[0]}px`,
        padding: "7px 12px"
      }
    case "medium":
      return {
        fontSize: `${theme.fontSizes[1]}px`,
        padding: "9.5px 18px"
      }
    case "large":
      return {
        fontSize: `${theme.fontSizes[2]}px`,
        padding: "12px 22px"
      }
    default:
      return {
        fontSize: `${theme.fontSizes[1]}px`,
        padding: "9.5px 18px"
      }
  }
};

export const fullWidth = (props: { fullWidth?: boolean }) => (props.fullWidth ? { width: "100%" } : null)

export type ButtonProps = ButtonStyleProps & { fullWidth?: boolean, textColor?: ThemeColor } & SpaceProps & SizeProps & { title?: string }

const Button = styled.button<ButtonProps>` 
  -webkit-font-smoothing: antialiased;
  display: inline-block;
  vertical-align: middle;
  text-align: center;
  text-decoration: none;
  font-family: inherit;
  font-weight: ${props => props.theme.bold};
  line-height: 1.5;
  cursor: pointer;
  border-radius: ${props => props.theme.radius};
  background-color: ${props => props.theme.colors[props.color!]};
  color: ${props => props.theme.colors[props.textColor!]};
  border-width: 0;
  border-style: solid;
  transition: ease 0.2s;

  &:disabled {
    opacity: 0.25;
  }

  &:focus {
    outline: none;
  }

  &:hover {
    transition: ease 0.15s;
    filter: ${props => props.disabled ? null : "brightness(125%)"};
    //transform: ${props => props.disabled ? null : "scale(1.03)"};
  }

  ${fullWidth} ${size} ${space};
`;

Button.defaultProps = {
  theme,
  textColor: "white",
  color: "blue"
};

Button.displayName = "Button";

export default Button;
