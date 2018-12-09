import * as React from 'react'
import styled from 'styled-components'
import { space, color, width, SpaceProps, ColorProps, WidthProps } from "styled-system"
import Text from "./Text"
import Icon from "./Icon"
import theme from './theme'


const SvgFtLabel = ({hasExt, ext}) => {
  if (!hasExt) {
    return null;
  }

  const color3="red";

  return (
    <>
      <path
        d="M41.537 56H1.463A1.463 1.463 0 0 1 0 54.537V39h43v15.537c0 .808-.655 1.463-1.463 1.463z"
        fill={color3}
      // fillRule="nonzero"
      />
      <text text-anchor="middle"
        x="21.5" y="53">{ext}</text>
    </>
  )
}


const SvgFt = ({color, color2, hasExt, ext, ...props}) => (
  <svg
    viewBox="0 0 43 56"
    fillRule="evenodd"
    clipRule="evenodd"
    {...props}
  >
    <path
      d="M29 0H1.463C.655 0 0 .655 0 1.926V55c0 .345.655 1 1.463 1h40.074c.808 0 1.463-.655 1.463-1V10L29 0z"
      fill={color}
      // fillRule="nonzero"
    />
    <path
      d="M29 0l14 10-12 2-2-12z"
      fill={color2}
    />
    <SvgFtLabel hasExt={hasExt} ext={ext} />
  </svg>
);

type FtLabelProps = WidthProps ;
const FtLabel = styled(Text)<FtLabelProps>`
    position: absolute;
    bottom: 1px;
    text-align:center;
    vertical-align: middle;
    ${width}
`;

const FtIconBase = ({ ext, size, theme, icon, ...props }): JSX.Element => {
  const hasExt = ext ? true : false;
  return (
    <>
      {
        icon ? (
          <Icon name={icon} size={size} color={theme.colors.FtIconColor2}/>
        ) : (
            <>
              <SvgFt width={size} height={size} color={theme.colors.FtIconColor} color2={theme.colors.FtIconColor2} hasExt={hasExt} ext={ext} {...props} />
            </>
          )
      }
    </>
  )
}

export interface FtIconProps extends SpaceProps, ColorProps {
  ext?: string
  cursor?: string
  icon?: string
}

const FtIcon = styled(FtIconBase) <FtIconProps>`
  flex: none;
  vertical-align: middle;
  cursor: ${props => props.cursor};
  ${space} ${color};

  & text {
    color: white;
    font-size: 16px;
    text-transform: uppercase;
    font-weight: bold;
    letter-spacing: 1px;
  }

`;

FtIcon.displayName = "FtIcon"

FtIcon.defaultProps = {
  theme,
  cursor: "inherit",
  size: 24
}

export default FtIcon
