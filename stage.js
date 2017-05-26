const POINT_COLOR = 'red';
const POINT_RADIUS = 8;
const PATH_COLOR = 'blue';
const PATH_STROKE = 2;
const BEZIER_COLOR = 'black';
const BEZIER_STROKE = 2;

const ALGORITHM = {
  DECASTELJAU: 0,
  BERNSTEIN_POLYNOMIAL: 1
}

const BEZIER_CURVE_ALGORITHM = ALGORITHM.BERNSTEIN_POLYNOMIAL;

const EVALUATIONS = 1000;

// Inicia a caminho de controle
var path = new Path().stroke(PATH_COLOR, PATH_STROKE).addTo(stage);

// Inicia o caminho da curva de bézier
var bézier = new Path().stroke(BEZIER_COLOR, BEZIER_STROKE).addTo(stage);

// Mapeamento de ID de pontos para ID de vétice do caminho de controle.
// Remoções de pontos irão dessincronizar o mapeamento
// ID do objeto círculo -> index de segmento no caminho de controle
var idMap = [ -1, -1, -1 ]; // Popula casas ignoradas
var diff = 3; // Diferença inicial de 3 (stage, caminho de contorle e curva)

stage.on('click', function(clickEvent) {
  target = clickEvent.target;

  // Verifica se o objeto clicado não é um ponto
  // id 0 = stage
  // id 1 = caminho de controle
  // id 2 = curva de bézier
  // id 3+ = pontos de controle
  if('id' in target && target.id <= 2) {
    x = clickEvent.x;
    y = clickEvent.y;

    // Ponto de controle
    point = new Circle(x, y, POINT_RADIUS).fill(POINT_COLOR).addTo(stage);

    // Mapeia o objeto
    idMap.push(point.id - diff);

    // Inicializa a função de arrasto do ponto
    point.on('drag', function(dragEvent) {
      // Move o ponto de controle
      this.attr({"x": dragEvent.x, "y": dragEvent.y});

      pointID = this.id;

      segments = path.segments();

      // Atualiza o caminho de controle, movendo a vértice correspondente
      segments[idMap[pointID]][1] = this.attr("x");
      segments[idMap[pointID]][2] = this.attr("y");

      path.segments(segments);

      // Atualiza a curva de bézier
      drawBezierCurve();
    });

    // Inicializa a função de clique duplo (remoção)
    point.on('doubleclick', function(dragEvent) {
      // Remove o ponto de controle
      stage.removeChild(this);

      // Incrementa a diferença no mapeamento ID -> segmento
      diff++;

      segments = path.segments();

      pointID = this.id;
      segIndex = idMap[pointID];

      // Arrasta todos as vértices do caminho de controle para a esquerda
      // Substituindo o ponto de controle que foi removido
      // E deixando um duplicado ao final do array
      for(var c = segIndex; c < segments.length - 1; c++) {
        segments[c] = segments[c + 1];

        // Caso seja o primeiro segmento, seta como inicial
        if(c === 0) {
          segments[0][0] = "moveTo";
        }
      }

      // Corta o último elemento do segmento, que estava duplicado
      segments = segments.splice(0, segments.length - 1);

      // Atualiza na tela
      path.segments(segments);

      // Atualiza o mapeamento ID -> segmento
      idMap[pointID] = -1; // Seta a posição do ponto de controle removido
      for(c = pointID + 1; c < segments.length + diff; c++) {
        idMap[c]--;
      }

      // Atualiza a curva de bézier
      drawBezierCurve();
    });

    // Adiciona uma vértice no caminho de controle
    if(path.segments().length === 0) {
      // Primeiro ponto
      path.moveTo(x, y);
    } else {
      // Posteriores
      path.lineTo(x, y);
    }

    // Atualiza a curva de bézier
    drawBezierCurve();
  }
});

// Desenha a curva de bézier
function drawBezierCurve() {
  // Não tem como desenhar a curva com menos de 2 pontos
  if(path.segments().length < 2) {
    return;
  }

  // Copia o array de vértices do caminho de controle (pontos de controle)
  var points = path.segments().splice(0);

  // Reseta a curva atual
  bézier.segments(Array(0));

  // Ponto de partida
  bézier.moveTo(points[0][1], points[0][2]);

  // Calcula e insere as interpolações na curva de bézier
  var n = points.length - 1;
  var x = 0, y = 0;
  var bern;
  for(var t = 1 / EVALUATIONS; t < 1; t += 1 / EVALUATIONS, x = 0, y = 0) {
    if(BEZIER_CURVE_ALGORITHM === ALGORITHM.DECASTELJAU) {
      for(var p = 1; p < points.length; p++) {
        for(var c = 0; c < points.length - p; c++) {
          points[c][1] = (1 - t) * points[c][1] + t * points[c + 1][1];
          points[c][2] = (1 - t) * points[c][2] + t * points[c + 1][2];
        }
      }

      // A interpolação fica armazenada no primeiro index do array
      x = points[0][1];
      y = points[0][2];
    } else {
      for(var i = 0; i <= n; i++) {
        // Calcula o coeficiente do polinômio de bézier
        bern = coefficient(n, i) * Math.pow(1 - t, n - i) * Math.pow(t, i);

        x += bern * points[i][1];
        y += bern * points[i][2];
      }
    }

    // Independente do algoritmo, insere a vértice na curva de bézier
    bézier.lineTo(x, y);
  }

  // Ponto final
  bézier.lineTo(points[n][1], points[n][2]);
}

//---------------------- APENAS PARA BERNSTEIN ---------------------------------

if(BEZIER_CURVE_ALGORITHM === ALGORITHM.BERNSTEIN_POLYNOMIAL) {
  // Array do triângulo de pascal
  var pascal = {};

  // Retorna ou calcula, caso necessário, o coeficiente do triângulo de pascal
  function coefficient(n, i) {
    if(n >= pascal.length) {
      // Calcula e memoriza todas as linhas <= n não presente no cache
      for(var row = pascal.length; row <= n; row++) {
        pascal[row] = [];
        for(var col = 0; col < row + 1; col++) {
          if(col === 0 || col === row) {
            pascal[row][col] = 1;
          } else {
            pascal[row][col] = pascal[row - 1][col - 1] + pascal[row - 1][col];
          }
        }
      }
    }

    return pascal[n][i];
  }
}

//------------------------------------------------------------------------------
