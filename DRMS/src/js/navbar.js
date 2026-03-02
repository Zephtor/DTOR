document.addEventListener('DOMContentLoaded', function(){
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-navigation');

  if(!toggle || !nav) return;

  function openNav(){
    nav.classList.add('open');
    toggle.setAttribute('aria-expanded','true');
    document.body.style.overflow = 'hidden';
    // focus first link for accessibility
    const firstLink = nav.querySelector('a');
    if(firstLink) firstLink.focus();
  }

  function closeNav(){
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
    document.body.style.overflow = '';
    toggle.focus();
  }

  toggle.addEventListener('click', ()=>{
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if(expanded) closeNav(); else openNav();
  });

  // Close on outside click or escape
  document.addEventListener('click', (e)=>{
    if(!nav.classList.contains('open')) return;
    if(e.target.closest('.nav-inner')) return;
    closeNav();
  });

  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && nav.classList.contains('open')) closeNav();
  });
});
