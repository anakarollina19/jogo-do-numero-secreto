const niveis = {
    facil: { nome: 'Fácil', limite: 10, maxTentativas: 4 },
    medio: { nome: 'Médio', limite: 100, maxTentativas: 8 },
    hacker: { nome: 'Hacker', limite: 1000, maxTentativas: 11 }
};

let nivelAtual = 'facil';
let listaDeNumerosSorteados = [];
let numeroSecreto;
let tentativas = 0;
let minimoPossivel;
let maximoPossivel;
let inicio = null;
let cronometro = null;
let jogoAcabou = false;
let vozLigada = lerStorage('vozLigada', true);

const campoChute = document.getElementById('chute');
const botaoChutar = document.getElementById('chutar');
const botaoReiniciar = document.getElementById('reiniciar');
const botaoVoz = document.getElementById('voz');
const titulo = document.getElementById('titulo');
const mensagem = document.getElementById('mensagem');

function lerStorage(chave, padrao) {
    try {
        const valor = localStorage.getItem(chave);
        return valor === null ? padrao : JSON.parse(valor);
    } catch {
        return padrao;
    }
}

function salvarStorage(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
    } catch {}
}

// Voz nativa do navegador (sem dependência externa)
function falar(texto) {
    if (!vozLigada || !('speechSynthesis' in window)) return;
    const fala = new SpeechSynthesisUtterance(texto.replace(/<[^>]*>/g, ''));
    fala.lang = 'pt-BR';
    fala.rate = 1.2;
    speechSynthesis.cancel();
    speechSynthesis.speak(fala);
}

function exibirMensagem(textoTitulo, textoMensagem) {
    if (textoTitulo) titulo.innerHTML = textoTitulo;
    mensagem.textContent = textoMensagem;
    falar(textoTitulo ? `${textoTitulo}. ${textoMensagem}` : textoMensagem);
}

function atualizarBotaoVoz() {
    botaoVoz.textContent = vozLigada ? '🔊 Voz' : '🔇 Voz';
    botaoVoz.setAttribute('aria-pressed', vozLigada);
}

function gerarNumeroAleatorio() {
    const limite = niveis[nivelAtual].limite;
    if (listaDeNumerosSorteados.length >= Math.min(limite, 50)) {
        listaDeNumerosSorteados = [];
    }
    let numeroEscolhido;
    do {
        numeroEscolhido = Math.floor(Math.random() * limite) + 1;
    } while (listaDeNumerosSorteados.includes(numeroEscolhido));
    listaDeNumerosSorteados.push(numeroEscolhido);
    return numeroEscolhido;
}

function iniciarJogo() {
    const nivel = niveis[nivelAtual];
    numeroSecreto = gerarNumeroAleatorio();
    tentativas = 0;
    minimoPossivel = 1;
    maximoPossivel = nivel.limite;
    jogoAcabou = false;
    inicio = null;
    clearInterval(cronometro);
    document.getElementById('tempo').textContent = '0.0s';

    campoChute.value = '';
    campoChute.max = nivel.limite;
    campoChute.disabled = false;
    botaoChutar.disabled = false;
    botaoReiniciar.disabled = true;
    document.body.style.setProperty('--calor', 210);
    document.getElementById('personagem').className = 'container__imagem-pessoa';

    atualizarTermometro(null);
    atualizarFaixa();
    atualizarStatus();
    exibirMensagem(
        'Adivinhe o <span class="container__texto-azul">número secreto</span>',
        `Escolha um número entre 1 e ${nivel.limite}`
    );
    renderizarRanking();
    campoChute.focus();
}

function verificarChute(evento) {
    evento.preventDefault();
    if (jogoAcabou) return;

    const nivel = niveis[nivelAtual];
    const chute = Number(campoChute.value);

    if (campoChute.value === '' || !Number.isInteger(chute) || chute < 1 || chute > nivel.limite) {
        exibirMensagem(null, `Digite um número inteiro entre 1 e ${nivel.limite}`);
        tremer();
        return;
    }

    if (!inicio) {
        inicio = Date.now();
        cronometro = setInterval(atualizarTempo, 100);
    }
    tentativas++;
    atualizarStatus();

    if (chute === numeroSecreto) {
        vencer();
        return;
    }

    if (chute > numeroSecreto) {
        maximoPossivel = Math.min(maximoPossivel, chute - 1);
    } else {
        minimoPossivel = Math.max(minimoPossivel, chute + 1);
    }
    atualizarFaixa();
    atualizarTermometro(chute);

    if (tentativas >= nivel.maxTentativas) {
        perder();
        return;
    }

    const restantes = nivel.maxTentativas - tentativas;
    const direcao = chute > numeroSecreto ? 'menor' : 'maior';
    exibirMensagem(null, `O número secreto é ${direcao}. Restam ${restantes} ${restantes > 1 ? 'tentativas' : 'tentativa'}.`);
    tremer();
    campoChute.value = '';
    campoChute.focus();
}

function finalizar() {
    jogoAcabou = true;
    clearInterval(cronometro);
    campoChute.disabled = true;
    botaoChutar.disabled = true;
    botaoReiniciar.disabled = false;
    botaoReiniciar.focus();
}

function vencer() {
    finalizar();
    const segundos = inicio ? (Date.now() - inicio) / 1000 : 0;
    const nivel = niveis[nivelAtual];
    const pontos = calcularPontos(nivel, segundos);
    const palavraTentativa = tentativas > 1 ? 'tentativas' : 'tentativa';
    const recorde = salvarNoRanking(pontos, segundos);

    document.body.style.setProperty('--calor', 140);
    atualizarTermometro(numeroSecreto, true);
    minimoPossivel = maximoPossivel = numeroSecreto;
    atualizarFaixa();
    document.getElementById('personagem').classList.add('personagem--feliz');

    exibirMensagem(
        recorde ? 'Novo recorde! 🏆' : 'Acertou! 🎉',
        `Você descobriu o número ${numeroSecreto} com ${tentativas} ${palavraTentativa} em ${segundos.toFixed(1)}s. ${pontos} pontos!`
    );
    soltarConfete();
    tocarSom(true);
    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
}

function perder() {
    finalizar();
    document.getElementById('personagem').classList.add('personagem--triste');
    exibirMensagem('Fim de jogo 💀', `Suas tentativas acabaram. O número secreto era ${numeroSecreto}.`);
    tocarSom(false);
    if (navigator.vibrate) navigator.vibrate(300);
}

function calcularPontos(nivel, segundos) {
    const bonusTentativas = (nivel.maxTentativas - tentativas + 1) * 100;
    const bonusTempo = Math.max(0, 300 - Math.round(segundos * 5));
    const multiplicador = { facil: 1, medio: 2, hacker: 4 }[nivelAtual];
    return (bonusTentativas + bonusTempo) * multiplicador;
}

// Termômetro: quanto mais perto, mais quente
function atualizarTermometro(chute, acertou = false) {
    const barra = document.getElementById('termometro-barra');
    const rotulo = document.getElementById('termometro-rotulo');
    if (chute === null) {
        barra.style.width = '0%';
        rotulo.textContent = 'Faça seu primeiro chute';
        return;
    }
    const limite = niveis[nivelAtual].limite;
    const proximidade = acertou ? 1 : 1 - Math.abs(chute - numeroSecreto) / limite;
    const calor = Math.round(210 - proximidade * 210); // 210 = azul gelado, 0 = vermelho
    barra.style.width = `${Math.max(5, proximidade * 100)}%`;
    if (!acertou) document.body.style.setProperty('--calor', calor);

    const faixas = [
        [1, '🎯 Na mosca!'],
        [0.95, '🔥 Fervendo!'],
        [0.85, '🌶️ Quente'],
        [0.7, '🙂 Morno'],
        [0.4, '🥶 Frio'],
        [0, '🧊 Congelando']
    ];
    rotulo.textContent = faixas.find(([min]) => proximidade >= min)[1];
}

function atualizarFaixa() {
    const limite = niveis[nivelAtual].limite;
    const inicioPct = ((minimoPossivel - 1) / limite) * 100;
    const larguraPct = ((maximoPossivel - minimoPossivel + 1) / limite) * 100;
    const faixa = document.getElementById('faixa-possivel');
    faixa.style.left = `${inicioPct}%`;
    faixa.style.width = `${larguraPct}%`;
    document.getElementById('faixa-min').textContent = minimoPossivel;
    document.getElementById('faixa-max').textContent = maximoPossivel;
}

function atualizarStatus() {
    document.getElementById('tentativas').textContent = `${tentativas}/${niveis[nivelAtual].maxTentativas}`;
}

function atualizarTempo() {
    document.getElementById('tempo').textContent = `${((Date.now() - inicio) / 1000).toFixed(1)}s`;
}

function tremer() {
    campoChute.classList.remove('tremer');
    void campoChute.offsetWidth;
    campoChute.classList.add('tremer');
}

// Ranking local, top 5 por nível
function salvarNoRanking(pontos, segundos) {
    const ranking = lerStorage('ranking', {});
    const lista = ranking[nivelAtual] || [];
    const recorde = lista.length === 0 || pontos > lista[0].pontos;
    lista.push({ pontos, tentativas, segundos: Number(segundos.toFixed(1)), data: new Date().toLocaleDateString('pt-BR') });
    lista.sort((a, b) => b.pontos - a.pontos);
    ranking[nivelAtual] = lista.slice(0, 5);
    salvarStorage('ranking', ranking);
    renderizarRanking();
    return recorde;
}

function renderizarRanking() {
    const lista = lerStorage('ranking', {})[nivelAtual] || [];
    document.getElementById('ranking-nivel').textContent = niveis[nivelAtual].nome;
    const ol = document.getElementById('ranking-lista');
    ol.innerHTML = lista.length
        ? lista.map(r => `<li><strong>${r.pontos} pts</strong><span>${r.tentativas} tent. · ${r.segundos}s · ${r.data}</span></li>`).join('')
        : '<li class="ranking__vazio">Nenhuma vitória ainda. Seja o primeiro!</li>';
}

// Efeitos sonoros gerados com Web Audio (sem arquivos)
function tocarSom(vitoria) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notas = vitoria ? [523, 659, 784, 1047] : [392, 330, 262];
        notas.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const ganho = ctx.createGain();
            osc.type = vitoria ? 'triangle' : 'sawtooth';
            osc.frequency.value = freq;
            const t = ctx.currentTime + i * 0.12;
            ganho.gain.setValueAtTime(0.15, t);
            ganho.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
            osc.connect(ganho).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
        });
    } catch {}
}

function soltarConfete() {
    const canvas = document.getElementById('confete');
    const ctx = canvas.getContext('2d');
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    const cores = ['#1875E8', '#FFD43B', '#FF6B6B', '#51CF66', '#FFFFFF'];
    const pedacos = Array.from({ length: 160 }, () => ({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 18,
        vy: Math.random() * -16 - 4,
        tam: Math.random() * 8 + 4,
        cor: cores[Math.floor(Math.random() * cores.length)],
        giro: Math.random() * Math.PI
    }));
    let quadros = 0;
    (function animar() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pedacos.forEach(p => {
            p.vy += 0.4;
            p.x += p.vx;
            p.y += p.vy;
            p.giro += 0.2;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.giro);
            ctx.fillStyle = p.cor;
            ctx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
            ctx.restore();
        });
        if (++quadros < 180) requestAnimationFrame(animar);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    })();
}

document.getElementById('form-chute').addEventListener('submit', verificarChute);
botaoReiniciar.addEventListener('click', iniciarJogo);
botaoVoz.addEventListener('click', () => {
    vozLigada = !vozLigada;
    salvarStorage('vozLigada', vozLigada);
    if (!vozLigada && 'speechSynthesis' in window) speechSynthesis.cancel();
    atualizarBotaoVoz();
});
document.querySelectorAll('.nivel').forEach(botao => {
    botao.addEventListener('click', () => {
        document.querySelectorAll('.nivel').forEach(b => b.classList.remove('nivel--ativo'));
        botao.classList.add('nivel--ativo');
        nivelAtual = botao.dataset.nivel;
        listaDeNumerosSorteados = [];
        iniciarJogo();
    });
});

atualizarBotaoVoz();
iniciarJogo();
