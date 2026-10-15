import { Radio } from "lucide-react";
export default function Brand() {
  return (
    <a className="brand" href="/" aria-label="GasAlert – úvod">
      <span className="brand-mark">
        <Radio size={22} />
      </span>
      <span>
        GASALERT<small>TRAINING SIMULATOR</small>
      </span>
    </a>
  );
}
