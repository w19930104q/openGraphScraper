import type { MediaFieldName, OgObjectInternal } from './types';
type Fields = {
    multiple: boolean;
    property: string;
    fieldName: keyof OgObjectInternal | MediaFieldName;
}[];
/**
 * array of meta tags ogs is looking for
 *
 * @return {array} array of meta tags
 *
 */
declare const fields: Fields;
export default fields;
