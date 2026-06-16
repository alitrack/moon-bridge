import type { MdFilledButton } from "@material/web/button/filled-button.js";
import type { MdOutlinedButton } from "@material/web/button/outlined-button.js";
import type { MdChipSet } from "@material/web/chips/chip-set.js";
import type { MdFilterChip } from "@material/web/chips/filter-chip.js";
import type { MdInputChip } from "@material/web/chips/input-chip.js";
import type { MdCheckbox } from "@material/web/checkbox/checkbox.js";
import type { MdDialog } from "@material/web/dialog/dialog.js";
import type { MdIcon } from "@material/web/icon/icon.js";
import type { MdIconButton } from "@material/web/iconbutton/icon-button.js";
import type { MdOutlinedSelect } from "@material/web/select/outlined-select.js";
import type { MdSelectOption } from "@material/web/select/select-option.js";
import type { MdSwitch } from "@material/web/switch/switch.js";
import type { MdFilledTextField } from "@material/web/textfield/filled-text-field.js";
import type { MdOutlinedTextField } from "@material/web/textfield/outlined-text-field.js";

declare module "react/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "md-chip-set": React.DetailedHTMLProps<React.HTMLAttributes<MdChipSet>, MdChipSet>;
      "md-checkbox": React.DetailedHTMLProps<React.HTMLAttributes<MdCheckbox>, MdCheckbox>;
      "md-dialog": React.DetailedHTMLProps<React.HTMLAttributes<MdDialog>, MdDialog>;
      "md-filter-chip": React.DetailedHTMLProps<React.HTMLAttributes<MdFilterChip>, MdFilterChip>;
      "md-input-chip": React.DetailedHTMLProps<React.HTMLAttributes<MdInputChip>, MdInputChip> & {
        disabled?: boolean;
        "remove-only"?: boolean;
        selected?: boolean;
      };
      "md-filled-button": React.DetailedHTMLProps<React.HTMLAttributes<MdFilledButton>, MdFilledButton> & {
        disabled?: boolean;
        "has-icon"?: boolean;
        type?: "button" | "reset" | "submit";
      };
      "md-filled-text-field": React.DetailedHTMLProps<React.HTMLAttributes<MdFilledTextField>, MdFilledTextField> & {
        label?: string;
        type?: "email" | "number" | "password" | "search" | "tel" | "text" | "url" | "textarea";
      };
      "md-icon": React.DetailedHTMLProps<React.HTMLAttributes<MdIcon>, MdIcon> & {
        slot?: string;
      };
      "md-icon-button": React.DetailedHTMLProps<React.HTMLAttributes<MdIconButton>, MdIconButton> & {
        disabled?: boolean;
        type?: "button" | "reset" | "submit";
      };
      "md-outlined-button": React.DetailedHTMLProps<React.HTMLAttributes<MdOutlinedButton>, MdOutlinedButton> & {
        disabled?: boolean;
        "has-icon"?: boolean;
        type?: "button" | "reset" | "submit";
      };
      "md-outlined-select": React.DetailedHTMLProps<React.HTMLAttributes<MdOutlinedSelect>, MdOutlinedSelect> & {
        "clamp-menu-width"?: boolean;
        "menu-positioning"?: "absolute" | "fixed" | "popover";
        label?: string;
      };
      "md-outlined-text-field": React.DetailedHTMLProps<React.HTMLAttributes<MdOutlinedTextField>, MdOutlinedTextField> & {
        label?: string;
        type?: "email" | "number" | "password" | "search" | "tel" | "text" | "url" | "textarea";
      };
      "md-select-option": React.DetailedHTMLProps<React.HTMLAttributes<MdSelectOption>, MdSelectOption> & {
        "display-text"?: string;
        selected?: boolean;
        value?: string;
      };
      "md-switch": React.DetailedHTMLProps<React.HTMLAttributes<MdSwitch>, MdSwitch>;
    }
  }
}
