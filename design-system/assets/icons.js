/* VetCrew icon helper — wraps Lucide (MIT) for use in cards & UI kits.
   Load order: React → Lucide UMD → this file. Then use <VC.Icon name="heart"/>.
   Imperatively renders into a ref span so it survives React re-renders.
   RTL: pass flip to mirror directional glyphs (chevrons/arrows). */
(function () {
  var R = window.React;
  if (!R) { console.error("icons.js: React must load first"); return; }
  function Icon(props) {
    var name = props.name, size = props.size || 20, stroke = props.stroke || 2,
        flip = props.flip, className = props.className || "", style = props.style || {};
    var ref = R.useRef(null);
    R.useEffect(function () {
      var host = ref.current; if (!host) return;
      host.innerHTML = "";
      var i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      host.appendChild(i);
      if (window.lucide) window.lucide.createIcons({ attrs: { width: size, height: size, "stroke-width": stroke } });
    });
    return R.createElement("span", {
      ref: ref, className: "vcico " + className, "aria-hidden": "true",
      style: Object.assign({ display: "inline-flex", width: size, height: size, flex: "0 0 auto", transform: flip ? "scaleX(-1)" : undefined }, style),
    });
  }
  window.VC = window.VC || {};
  window.VC.Icon = Icon;
})();
