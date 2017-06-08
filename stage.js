const POINT_COLOR = 'red';
const POINT_RADIUS = 8;
const PATH_COLOR = 'blue';
const PATH_STROKE = 2;
const HULL_COLOR = 'green';
const HULL_STROKE = 5;
const BEZIER_COLOR = 'white';
const BEZIER_STROKE = 2;

const ONE_RADIAN = 57.295779513082;

var BEZIER_CURVE_ALGORITHM = 0;

var EVALUATIONS = 500;

var showPoint = true;


/* global stage */
/* global Path */
/* global Circle */

// Inicia a caminho de controle
var path = new Path().stroke(PATH_COLOR, PATH_STROKE).addTo(stage);

// Inicia o caminho da curva de bézier
var bezier = new Path().stroke(BEZIER_COLOR, BEZIER_STROKE).addTo(stage);

// Inicia caminho do invólucro convexo
var hull = new Path().stroke(HULL_COLOR, HULL_STROKE).addTo(stage);
hull.attr("strokeDash", [ 10, 20 ]);

// Mapeamento de ID de pontos para ID de vétice do caminho de controle.
// Remoções de pontos irão dessincronizar o mapeamento
// ID do objeto círculo -> index de segmento no caminho de controle
var idMap = [ -1, -1, -1, -1 ]; // Popula casas ignoradas
var diff = 4; // Diferença inicial de 3 (stage, caminho de contorle e curva)

// Obtém o valor de x ajustado a tela
function adjustHLimit(x) {
  x = Math.min(stage.options.width - POINT_RADIUS - 2, x);
  x = Math.max(POINT_RADIUS + 1, x);
  return x;
}

// Obtém o valor de y ajustado a tela
function adjustVLimit(y) {
  y = Math.min(stage.options.height - POINT_RADIUS - 2, y);
  y = Math.max(POINT_RADIUS + 1, y);
  return y;
}

stage.on('click', function(clickEvent) {
  var target = clickEvent.target;

  // Verifica se o objeto clicado não é um ponto
  if(!(target instanceof Circle)) {
    var x = adjustHLimit(clickEvent.x);
    var y = adjustVLimit(clickEvent.y);

    // Ponto de controle
    var point = new Circle(x, y, POINT_RADIUS).fill(POINT_COLOR).addTo(stage);

    if(!showPoint) {
      point.attr("radius", 0);
    }

    // Mapeia o objeto
    idMap.push(point.id - diff);

    // Inicializa a função de arrasto do ponto
    point.on('drag', function(dragEvent) {
      // Move o ponto de controle
      this.attr({
        "x": adjustHLimit(dragEvent.x),
        "y": adjustVLimit(dragEvent.y)
      });

      var pointID = this.id;

      var segments = path.segments();

      // Atualiza o caminho de controle, movendo a vértice correspondente
      segments[idMap[pointID]][1] = this.attr("x");
      segments[idMap[pointID]][2] = this.attr("y");

      path.segments(segments);

      // Atualiza a curva de bézier
      drawBezierCurve();
    });

    // Inicializa a função de clique duplo (remoção)
    point.on('dblclick', function(removeEvent) {
      // Remove o ponto de controle
      stage.removeChild(this);

      // Incrementa a diferença no mapeamento ID -> segmento
      diff++;

      var segments = path.segments();

      var pointID = this.id;
      var segIndex = idMap[pointID];

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

//-------------------------------- Eventos -------------------------------------

stage.on('message:algorithm', function(message) {
  BEZIER_CURVE_ALGORITHM = message.data;

  drawBezierCurve();
});

stage.on('message:evaluations', function(message) {
  EVALUATIONS = message.data;

  drawBezierCurve();
});

stage.on('message:control-path', function(message) {
  if(message.data) {
    path.attr("strokeWidth", PATH_STROKE);
  } else {
    path.attr("strokeWidth", 0);
  }
});

stage.on('message:control-points', function(message) {
  if(message.data) {
    stage.children().forEach(function(point) {
      if(point instanceof Circle) {
        point.attr("radius", POINT_RADIUS);
      }
    });
  } else {
    stage.children().forEach(function(point) {
      if(point instanceof Circle) {
        point.attr("radius", 0);
      }
    });
  }

  showPoint = message.data;
});

stage.on('message:bezier-curve', function(message) {
  if(message.data) {
    bezier.attr("strokeWidth", BEZIER_STROKE);
  } else {
    bezier.attr("strokeWidth", 0);
  }
});

stage.on('message:convex-hull', function(message) {
  if(message.data) {
    hull.attr("strokeWidth", HULL_STROKE);
  } else {
    hull.attr("strokeWidth", 0);
  }
});

//------------------------------------------------------------------------------

// Desenha a curva de bézier
function drawBezierCurve() {
  // Não tem como desenhar a curva com menos de 2 pontos
  if(path.segments().length < 2) {
    return;
  }

  // Copia o array de vértices do caminho de controle (pontos de controle)
  var points = path.segments();

  // Reseta a curva atual
  bezier.segments(Array(0));

  // Ponto de partida
  bezier.moveTo(points[0][1], points[0][2]);
  
  // Calcula e insere as interpolações na curva de bézier
  var n = points.length - 1;
  var x = 0, y = 0;
  var bern;
  for(var t = 1 / EVALUATIONS; t < 1; t += 1 / EVALUATIONS, x = 0, y = 0) {
    if(BEZIER_CURVE_ALGORITHM == 0) {
      // Reseta o array de pontos
      points = path.segments();

      // Execução do algoritmo
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
      for(var c = 0; c <= n; c++) {
        // Calcula o coeficiente do polinômio de bézier
        bern = coefficient(n, c) * Math.pow(1 - t, n - c) * Math.pow(t, c);

        x += bern * points[c][1];
        y += bern * points[c][2];
      }
    }

    // Independente do algoritmo, insere a vértice na curva de bézier
    bezier.lineTo(x, y);
  }

  // Ponto final
  bezier.lineTo(points[n][1], points[n][2]);

  // Desenha o invólucro convexo
  drawConvexHull();
}

//---------------------- APENAS PARA BERNSTEIN ---------------------------------

// Array do triângulo de pascal
var pascal = [];

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

//------------------------------------------------------------------------------

// Acha o ângulo polar entre dois pontos
function findPolarAngle(a, b) {
  var deltaX = (b[1] - a[1]);
  var deltaY = (b[2] - a[2]);

  // Caso os pontos sejam iguais
  if (deltaX === 0 && deltaY === 0) {
      return 0;
  }

  var angle = Math.atan2(deltaY, deltaX) * ONE_RADIAN;

  if (angle < 0) {
    angle += 360;
  }

  // Necessário somar para precisão
  return angle + 0.0000001;
}

function drawConvexHull() {
  // Reseta o involucro convexo
  hull.segments(Array(0));

  // Não pode desenhar o invólucro convexo com menos de 3 pontos
  if(path.segments().length < 3) {
    return;
  }

  // Copia o array de vértices do caminho de controle (pontos de controle)
  var points = path.segments();

  // Pega o ponto com a menor coordenada y
  var anchor = points[0];
  for (var i = 0; i < points.length; i ++) {
    if (points[i][2] < anchor[2] ||
      (points[i][2] == anchor[2] && points[i][1] < anchor[1])) {
      anchor = points[i];
    }
  }

  // Ordena os pontos por ângulo polar em
  // relação ao ponto com menor coordenada y
  points.sort(function(a, b) {
    var aAngle = findPolarAngle(anchor, a);
    var bAngle = findPolarAngle(anchor, b);

    if (aAngle < bAngle) {
      return -1;
    } else if (aAngle > bAngle) {
      return 1;
    } else {
      return 0;
    }
  });

  // O primeiro e o segundo pontos iniciam dentro do invólucro convexo
  var convexHull = new Array();
  convexHull.push(points.shift(), points.shift());

  // Varre o array de pontos ordenado, verificando se o vetor diretor
  // da reta que liga os dois pontos é orientado para a esquerda ou direita
  // Se for pra esquerda, ele entra no invólucro convexo.
  while (points.length >= 1) {
    // Adciona, temporariamente, o ponto no invólucro convexo
    convexHull.push(points.shift());

    // Os 2 últimos pontos são usados para testar o novo
    var p1 = convexHull[convexHull.length - 3];
    var p2 = convexHull[convexHull.length - 2];
    var p3 = convexHull[convexHull.length - 1];

    // Variáveis auxiliares
    var p1x = p1[1];
    var p1y = p1[2];
    var p2x = p2[1];
    var p2y = p2[2];
    var p3x = p3[1];
    var p3y = p3[2];

    // Calcula o produto vetorial dos 3 pontos para saber se o ponto faz parte
    // do invólucro convexo
    // Se a área for menor ou igual a 0, o ponto não faz parte do invólucro
    if ((((p2x - p1x) * (p3y - p1y)) - ((p2y - p1y) * (p3x - p1x))) <= 0) {
      // Retira o ponto do invólucro e devolve o mesmo para ser testado com os
      // próximos
      points.unshift(convexHull.pop());

      // Don't even ask
      if(convexHull.length == 2) {
        convexHull[1] = points.shift();
        continue;
      }

      // Retira também o penúltimo ponto, pois também não faz parte do invólucro
      convexHull.pop();
    }
  }

  // Desenha o invólucro convexo
  for (var i = 0; i < convexHull.length; i++) {
    if (i == 0) {
      hull.moveTo(convexHull[i][1], convexHull[i][2]);
    } else {
      hull.lineTo(convexHull[i][1], convexHull[i][2]);
    }
  }

  // Fecha o invólucro
  hull.closePath();
}
