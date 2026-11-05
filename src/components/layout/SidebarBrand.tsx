import logoMark from '../../assets/Fav_icon.png'

export default function SidebarBrand() {
  return (
    <div className="flex items-center gap-3" role="img" aria-label="Top Cloud Rwenzori Adventures Ltd">
      <img src={logoMark} alt="" aria-hidden="true" className="h-20 w-16 shrink-0 object-contain" />
      <span className="min-w-0 text-white">
        <span className="block text-[0.65rem] font-medium tracking-[0.18em] text-white/85">TOP CLOUD</span>
        <span className="mt-0.5 block text-[1.35rem] font-bold leading-tight tracking-[-0.025em]">RWENZORI</span>
        <span className="mt-1 block text-[0.55rem] font-semibold tracking-[0.12em] text-white/90">ADVENTURES LTD</span>
      </span>
    </div>
  )
}
