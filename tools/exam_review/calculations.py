"""Independent, exact checks for the numerical examples in the video review."""
from decimal import Decimal
import math

DATA = (([1, 1, 2, 3], 1), ([1, 1, 1, 1], 1),
        ([1, -1, -1, -1], -1), ([1, -2, -2, -2], -1))
BATCHES = ((0, 3), (1, 2))

def training_example(activation="sign"):
    if activation not in ("sign", "identity"):
        raise ValueError("Unsupported activation")
    weights = list(map(Decimal, ("0", ".1", ".2", "-.3")))
    rate = Decimal(".01")
    iterations = []
    for batch in BATCHES:
        points = []
        delta = [Decimal(0)] * 4
        for index in batch:
            vector, target = DATA[index]
            z = sum(w * x for w, x in zip(weights, vector))
            prediction = Decimal((z > 0) - (z < 0)) if activation == "sign" else z
            error = Decimal(target) - prediction
            contribution = [rate * error * x for x in vector]
            delta = [a + b for a, b in zip(delta, contribution)]
            points.append(dict(index=index + 1, z=float(z), prediction=float(prediction),
                               error=float(error), delta=list(map(float, contribution))))
        weights = [w + d for w, d in zip(weights, delta)]
        iterations.append(dict(points=points, delta=list(map(float, delta)), weights=list(map(float, weights))))
    return iterations

def backprop(x=1.0, target=0.0, w=(1.0, 1.0), v=(1.0, 1.0)):
    hidden = [math.tanh(wi * x) for wi in w]
    output = sum(vi * hi for vi, hi in zip(v, hidden))
    error = output - target
    return dict(output=output, loss=0.5 * error ** 2,
                dv=[error * hi for hi in hidden],
                dw=[error * vi * (1 - hi ** 2) * x for vi, hi in zip(v, hidden)])
