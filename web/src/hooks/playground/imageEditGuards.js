/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import {
  ENDPOINT_TYPES,
  IMAGE_REQUEST_MODES,
} from '../../constants/playground.constants';

export const normalizeImageRequestMode = ({
  imageRequestMode,
  supportsEdits,
} = {}) => {
  if (supportsEdits === true && imageRequestMode === IMAGE_REQUEST_MODES.EDIT) {
    return IMAGE_REQUEST_MODES.EDIT;
  }

  return IMAGE_REQUEST_MODES.GENERATION;
};

export const shouldBlockImageEditRegeneration = ({
  endpointType,
  imageRequestMode,
  imageReferenceFiles,
}) =>
  endpointType === ENDPOINT_TYPES.IMAGE_GENERATION &&
  imageRequestMode === IMAGE_REQUEST_MODES.EDIT &&
  (!imageReferenceFiles || imageReferenceFiles.length === 0);
