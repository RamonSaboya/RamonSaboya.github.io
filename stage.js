const POINT_COLOR = 'red';
const POINT_RADIUS = 8;
const PATH_COLOR = 'blue';
const PATH_STROKE = 2;
const BEZIER_COLOR = 'black';
const BEZIER_STROKE = 2;

const EVALUATIONS = 500;

// Inicia a caminho de controle
var path = new Path().stroke(PATH_COLOR, PATH_STROKE).addTo(stage);

// Inicia o caminho da curva de bezier
var bezier = new Path().stroke(BEZIER_COLOR, BEZIER_STROKE).addTo(stage);

// Desenha a curva de bezier
function drawBezierCurve() {
  // Não tem como desenhar a curva com menos de 2 pontos
  if(path.segments().length < 2) {
    return;
  }

  // Copia a curva atual
  var points = path.segments().splice(0);

  // Reseta a curva atual
  bezier.segments(Array(0));

  // Ponto de partida
  bezier.moveTo(points[0][1], points[0][2]);

  // Calcula as interpolações
  for(var t = 1 / EVALUATIONS; t < 1; t += 1 / EVALUATIONS) {
    for(var p = 1; p < points.length; p++) {
      for(var c = 0; c < points.length - p; c++) {
        points[c][1] = (1 - t) * points[c][1] + t * points[c + 1][1];
        points[c][2] = (1 - t) * points[c][2] + t * points[c + 1][2];
      }
    }
    bezier.lineTo(points[0][1], points[0][2]);
  }

  // Ponto final
  bezier.moveTo(points[points.length - 1][1], points[points.length - 1][2]);
}

// Mapeamento de ID de pontos para ID de vétice do caminho de controle.
// Remoções de pontos irão dessincronizar o mapeamento
// ID do objeto círculo -> index de segmento no caminho de controle
var idMap = [ -1, -1, -1 ]; // Popula casas ignoradas
var diff = 3; // Diferença inicial de 2 (stage e path)

stage.on('click', function(clickEvent) {
  target = clickEvent.target;

  // Verifica se o objeto clicado não é um ponto
  // id 0 = stage
  // id 1 = path
  // id 2+ = pontos de controle
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

      // Atualiza a curva de bezier
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

      // Atualiza a curva de bezier
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

    // Atualiza a curva de bezier
    drawBezierCurve();
  }
});
