import styled from "styled-components";
import theme from "./theme";

const Image = styled.img`
  max-width: 100%;
  height: auto;
`;

Image.displayName = "Image";

Image.defaultProps = {
  theme
};

export default Image;
