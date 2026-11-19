import 'server-only';
import { getDatabase } from '../../db/client';
import { CommerceOrders } from './orders';
import { CommercePayments } from './payments';
import { razorpayGateway } from './config';
export const commerceOrders = () => new CommerceOrders(getDatabase());
export const commercePayments = () =>
  new CommercePayments(getDatabase(), razorpayGateway());
