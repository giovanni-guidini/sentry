import logging

logger = logging.getLogger(__name__)


def pow(x, exp):
    return x**exp


def hello():
    logger.info("This is a new file")
    logger.info("It is not used anywhere")
